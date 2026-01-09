/**
 * EFRO – HARDCORE v2 (SSOT, 2026-01-09)
 *
 * Ziel:
 * - Brutales, reproduzierbares Multi-Turn Conversation-Chaos gegen SellerBrain
 * - Default: FAST-MODE (inproc) -> Repo-Load wie /api/efro/suggest (kein Next-HTTP Overhead)
 * - Optional: HTTP-MODE (E2E) -> POST /api/efro/suggest gegen laufenden Server
 *
 * RUN (Quick):
 *   set -a; source .env.local; set +a
 *   EFRO_MODE=inproc EFRO_SHOP=avatarsalespro-dev.myshopify.com EFRO_SEED=1 EFRO_TARGET_TURNS=200 pnpm -s tsx scripts/test-hardcore-v2.ts
 *
 * ENV (SSOT):
 *   EFRO_MODE=inproc|http                 (default: inproc)
 *   EFRO_PRODUCTS_SOURCE=supabase|snapshot (default: supabase)
 *   EFRO_SNAPSHOT_PATH=...json            (default: scripts/fixtures/products-120.snapshot.json)
 *   EFRO_BASE_URL=http://127.0.0.1:3000   (nur http-mode)
 *   EFRO_SHOP=avatarsalespro-dev.myshopify.com
 *   EFRO_SEED=1
 *   EFRO_TARGET_TURNS=10000
 *   EFRO_CONVERSATIONS=250
 *   EFRO_CONV_MIN_TURNS=2
 *   EFRO_CONV_MAX_TURNS=8
 *   EFRO_EXPECT_RAW_COUNT=120
 *   EFRO_EXPECT_BAD_MAX=20
 *   EFRO_FAIL_FAST=0|1                   (default: 0)
 *   EFRO_QUIET=0|1                       (default: 1)
 *   EFRO_LOG_PATH=/tmp/hardcore-v2.log   (optional)
 *
 * Checks:
 *   EFRO_CHECK_MOJIBAKE=1
 *   EFRO_CHECK_NO_OPERATOR_HINTS=1
 *   EFRO_CHECK_RECO_MIN=1
 *   EFRO_CHECK_BUDGET=1
 *   EFRO_CHECK_POLICY_FAQ=1
 */

import fs from "node:fs";
import path from "node:path";

import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog";
import type { SellerBrainContext } from "../src/lib/sales/brain/types";

import {
  getEfroShopByDomain,
  getEfroDemoShop,
  getProductsForShop,
} from "../src/lib/efro/efroSupabaseRepository";

import {
  fixEncodingDeep,
  fixEncodingString,
  cleanText,
  normalizeTags,
} from "../src/lib/text/encoding";

type PlanName = "starter";
type PlanLimits = { maxRecommended: number };

type FailReason =
  | "mojibake"
  | "operator_hint_leak"
  | "budget_violation"
  | "anchor_keyword"
  | "reco_missing"
  | "policy_hallucination"
  | "crash";

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function nowStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Deterministic RNG (mulberry32)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return '"<unstringifiable>"';
  }
}

function fixStr(input: unknown): string {
  const raw = typeof input === "string" ? input : (input == null ? "" : String(input));
  const o: any = fixEncodingDeep({ v: raw });
  const v = typeof o?.v === "string" ? o.v : raw;
  return cleanText(v);
}

function fixReplyText(raw: unknown): string {
  const s0 = typeof raw === "string" ? raw : String(raw ?? "");
  const s1 = fixEncodingString(s0);
  return s1
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeProductsForBrain(raw: any[]): EfroProduct[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((p0: any) => {
    const p: any = fixEncodingDeep(p0 ?? {});
    const tags = normalizeTags(p?.tags ?? p?.tags_arr ?? p?.tags_norm ?? []);
    return {
      ...p,
      id: String(p?.id ?? ""),
      title: fixStr(p?.title ?? p?.name ?? ""),
      description: fixStr(p?.description ?? p?.body_html ?? ""),
      price: typeof p?.price === "number" ? p.price : (Number.parseFloat(String(p?.price ?? 0)) || 0),
      imageUrl: fixStr(p?.imageUrl ?? p?.image_url ?? ""),
      category: fixStr(p?.category ?? p?.product_type ?? "unknown") || "unknown",
      tags,
      rating: typeof p?.rating === "number" ? p.rating : 0,
      popularityScore: typeof p?.popularityScore === "number" ? p.popularityScore : 0,
    } as EfroProduct;
  });
}

function toTitle(p: any): string {
  return String(p?.title ?? p?.name ?? p?.product_title ?? p?.productTitle ?? p?.handle ?? "").trim();
}

function toId(p: any): string {
  return String(p?.id ?? p?.product_id ?? p?.productId ?? p?.sku ?? p?.handle ?? "").trim();
}

function uniqByIdOrTitle(items: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const it of items) {
    const key = toId(it) || toTitle(it) || safeJson(it);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function starterPlan(): { name: PlanName; limits: PlanLimits } {
  return { name: "starter", limits: { maxRecommended: 2 } };
}

function safeFallbackMention(replyText: string) {
  const t = replyText.toLowerCase();
  const needles = [
    "kann ich nicht",
    "kann das nicht",
    "nicht verifizieren",
    "habe keine",
    "keine produkte",
    "bitte im shop",
    "bitte prüf",
    "bitte prüfen",
    "support",
    "bedingungen",
    "hilfe",
    "leider",
  ];
  return needles.some((n) => t.includes(n));
}

function envBool(name: string, def: boolean) {
  const v = process.env[name];
  if (v == null || v === "") return def;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function envNum(name: string, def: number) {
  const v = process.env[name];
  if (v == null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function detectMojibake(s: string) {
  return /f�r|m�chtest|Zubeh�r|Ã|â€|�/g.test(s);
}

function detectOperatorLeak(s: string) {
  const t = s.toLowerCase();
  const needles = [
    "x-efro-debug",
    "operator",
    "nextcontext",
    "activecategory",
    "aitrigger",
    "token_source",
    "supabase_",
    "stack",
    "trace",
    "correlationid",
    "debug:",
  ];
  return needles.some((n) => t.includes(n));
}

function parseBudgetEuro(prompt: string): number | null {
  const s = prompt.toLowerCase();
  const m =
    s.match(/unter\s+(\d{1,5})(?:[.,](\d{1,2}))?\s*(€|euro)/) ||
    s.match(/max(?:imal)?\s+(\d{1,5})(?:[.,](\d{1,2}))?\s*(€|euro)/) ||
    s.match(/budget\s+(\d{1,5})(?:[.,](\d{1,2}))?\s*(€|euro)/);
  if (!m) return null;
  const whole = Number(m[1]);
  const frac = m[2] ? Number(`0.${m[2]}`) : 0;
  const val = whole + frac;
  return Number.isFinite(val) ? val : null;
}

function norm(s: string) {
  return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function isPolicyPrompt(p: string) {
  const t = norm(p);
  return (
    t.includes("versand") ||
    t.includes("retour") ||
    t.includes("rückgabe") ||
    t.includes("widerruf") ||
    t.includes("refund") ||
    t.includes("storno") ||
    t.includes("tracking") ||
    t.includes("garantie") ||
    t.includes("dsgvo") ||
    t.includes("datenschutz") ||
    t.includes("install") ||
    t.includes("billing") ||
    t.includes("kündig") ||
    t.includes("webhook") ||
    t.includes("oauth")
  );
}

function pickAnchorKeyword(prompt: string): string | null {
  const t = norm(prompt);
  const keys = [
    "snowboard",
    "parfum",
    "kosmetik",
    "zubehör",
    "zubehor",
    "küchenmesser",
    "kuechenmesser",
    "wasserkocher",
    "smartphone",
    "fahrrad",
  ];
  for (const k of keys) {
    if (t.includes(k)) return k;
  }
  return null;
}

function productHasAnchor(p: EfroProduct, anchor: string) {
  const a = norm(anchor);
  const t = norm((p as any)?.title);
  const c = norm((p as any)?.category);
  const tags = Array.isArray((p as any)?.tags) ? (p as any).tags.map(norm).join(" ") : "";
  return t.includes(a) || c.includes(a) || tags.includes(a);
}

function isBadProduct(p: EfroProduct) {
  const id = String((p as any)?.id ?? "").trim();
  const title = String((p as any)?.title ?? "").trim();
  const price = Number((p as any)?.price ?? 0);
  return !id || !title || !Number.isFinite(price) || price <= 0;
}

async function loadProductsInproc(shopDomain: string): Promise<{
  productsRaw: EfroProduct[];
  productsVisible: EfroProduct[];
  source: string;
  badCount: number;
}> {
  const shop =
    (shopDomain && shopDomain.toLowerCase() !== "demo" ? await getEfroShopByDomain(shopDomain) : null) ??
    (await getEfroDemoShop());

  if (!shop) return { productsRaw: [], productsVisible: [], source: "repo:none", badCount: 0 };

  const r: any = await getProductsForShop(shop as any);
  const raw = normalizeProductsForBrain((r as any)?.products ?? []);
  const bad = raw.filter(isBadProduct);
  const good = raw.filter((p) => !isBadProduct(p));
  const src = (r as any)?.source || "products";
  return { productsRaw: raw, productsVisible: good, source: `supabase_${src}`, badCount: bad.length };
}

async function loadProductsSnapshot(snapshotPath: string): Promise<{
  productsRaw: EfroProduct[];
  productsVisible: EfroProduct[];
  source: string;
  badCount: number;
}> {
  const p = path.resolve(process.cwd(), snapshotPath);
  const txt = fs.readFileSync(p, "utf8");
  const data = JSON.parse(txt);
  const rawArr = Array.isArray(data) ? data : (data?.products ?? data?.items ?? []);
  const raw = normalizeProductsForBrain(rawArr);
  const bad = raw.filter(isBadProduct);
  const good = raw.filter((p) => !isBadProduct(p));
  return { productsRaw: raw, productsVisible: good, source: "snapshot", badCount: bad.length };
}

async function callSuggestHttp(params: {
  baseUrl: string;
  shop: string;
  text: string;
  prevIntent: string;
  plan: string;
  previousRecommendedIds: string[];
  context: any;
}) {
  const url = `${params.baseUrl.replace(/\/$/, "")}/api/efro/suggest`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "accept": "application/json" },
    body: JSON.stringify({
      shop: params.shop,
      text: params.text,
      prevIntent: params.prevIntent,
      plan: params.plan,
      previousRecommendedIds: params.previousRecommendedIds,
      context: params.context,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} POST ${url}`);
  const j = await res.json();
  const replyText = fixReplyText(j?.replyText ?? "");
  const recommended = normalizeProductsForBrain(j?.recommended ?? []);
  const intent = String(j?.intent ?? params.prevIntent);
  const nextContext = (j?.sellerBrain?.nextContext ?? null) as any;
  return { replyText, recommended, intent, nextContext, productsSource: j?.productsSource, productCount: j?.productCount };
}

async function main() {
  const seed = envNum("EFRO_SEED", 1);
  const rng = mulberry32(seed);

  const mode = String(process.env.EFRO_MODE ?? "inproc").toLowerCase() as "inproc" | "http";
  const productsSource = String(process.env.EFRO_PRODUCTS_SOURCE ?? "supabase").toLowerCase() as "supabase" | "snapshot";

  const shop = String(process.env.EFRO_SHOP ?? "avatarsalespro-dev.myshopify.com");
  const baseUrl = String(process.env.EFRO_BASE_URL ?? "http://127.0.0.1:3000");

  const targetTurns = envNum("EFRO_TARGET_TURNS", 10000);
  const convCount = envNum("EFRO_CONVERSATIONS", 250);
  const convMin = envNum("EFRO_CONV_MIN_TURNS", 2);
  const convMax = envNum("EFRO_CONV_MAX_TURNS", 8);

  const expectRaw = envNum("EFRO_EXPECT_RAW_COUNT", 120);
  const expectBadMax = envNum("EFRO_EXPECT_BAD_MAX", 20);

  const failFast = envBool("EFRO_FAIL_FAST", false);
  const quiet = envBool("EFRO_QUIET", true);

  const checkMojibake = envBool("EFRO_CHECK_MOJIBAKE", true);
  const checkNoOperatorHints = envBool("EFRO_CHECK_NO_OPERATOR_HINTS", true);
  const checkRecoMin = envBool("EFRO_CHECK_RECO_MIN", true);
  const checkBudget = envBool("EFRO_CHECK_BUDGET", true);
  const checkPolicy = envBool("EFRO_CHECK_POLICY_FAQ", true);

  const plan = starterPlan();

  const logsDir = path.resolve(process.cwd(), "logs");
  ensureDir(logsDir);

  const stamp = nowStamp();
  const logPath =
    process.env.EFRO_LOG_PATH && String(process.env.EFRO_LOG_PATH).trim()
      ? String(process.env.EFRO_LOG_PATH)
      : path.join(logsDir, `hardcore-v2-${mode}-${productsSource}-${stamp}.log`);

  const started = Date.now();

  // Products truth (FAST default)
  let productsRaw: EfroProduct[] = [];
  let productsVisible: EfroProduct[] = [];
  let productsSourceLabel = "unknown";
  let badCount = 0;

  if (productsSource === "snapshot") {
    const snapPath = String(process.env.EFRO_SNAPSHOT_PATH ?? "scripts/fixtures/products-120.snapshot.json");
    const r = await loadProductsSnapshot(snapPath);
    productsRaw = r.productsRaw;
    productsVisible = r.productsVisible;
    productsSourceLabel = r.source;
    badCount = r.badCount;
  } else {
    const r = await loadProductsInproc(shop);
    productsRaw = r.productsRaw;
    productsVisible = r.productsVisible;
    productsSourceLabel = r.source;
    badCount = r.badCount;
  }

  const rawCount = productsRaw.length;
  const visibleCount = productsVisible.length;

  // Hard guards (SSOT)
  if (expectRaw > 0 && rawCount !== expectRaw) {
    console.error("[HARDCORE-V2] HARD-GUARD FAIL: rawCount mismatch", { expectRaw, rawCount, productsSource: productsSourceLabel });
    process.exit(2);
  }
  if (badCount > expectBadMax) {
    console.error("[HARDCORE-V2] HARD-GUARD FAIL: too many bad products", { expectBadMax, badCount });
    process.exit(2);
  }

  const header = {
    mode,
    productsSource,
    shop,
    seed,
    targetTurns,
    conversations: convCount,
    convMin,
    convMax,
    rawCount,
    badCount,
    visibleCount,
    productsSourceLabel,
  };

  if (!quiet) console.log("[HARDCORE-V2] HEADER", header);

  const logLines: string[] = [];
  logLines.push(`[HEADER] ${safeJson(header)}`);

  const failCounts = new Map<FailReason, number>();
  const keywordCounts = new Map<string, number>();
  const msArr: number[] = [];
  let totalTurns = 0;
  let totalFails = 0;

  const promptsIntent = [
    {
      intent: "quick_buy",
      templates: [
        "snowboard unter {B} euro",
        "parfum unter {B} euro",
        "zubehör für {K} unter {B}€",
        "ich brauche {K} günstig, max {B} euro",
        "zeige mir {K} bitte",
      ],
    },
    {
      intent: "explore",
      templates: [
        "zeige mir etwas für meine frau, budget {B}€, parfum",
        "I need something under {B}€",
        "Do you ship to Germany? tracking?",
        "ruckgabe / widerruf – wie geht das?",
        "küchenmesser / kuechenmesser – was empfiehlst du?",
        "snowbord günstigstes",
        "kosmetk geschenk set billig",
        "parfmu unter {B}",
        "OAuth: invalid redirect – was tun?",
        "Wie kündige ich mein Abo? Billing Portal?",
      ],
    },
  ];

  const categoryPool = ["parfum", "kosmetik", "snowboard", "zubehör", "küchenmesser", "wasserkocher", "smartphone"];
  const budgets = [10, 15, 20, 25, 30, 40, 50, 75, 100, 150];

  function materialize(template: string) {
    const B = pick(rng, budgets);
    const K = pick(rng, categoryPool);
    return template.replaceAll("{B}", String(B)).replaceAll("{K}", String(K));
  }

  function chooseTurnPrompt() {
    const pack = pick(rng, promptsIntent);
    const prompt = materialize(pick(rng, pack.templates));
    return { prompt, prevIntent: pack.intent };
  }

  function recordFail(reason: FailReason) {
    failCounts.set(reason, (failCounts.get(reason) ?? 0) + 1);
  }

  function bumpKeyword(k: string) {
    keywordCounts.set(k, (keywordCounts.get(k) ?? 0) + 1);
  }

  async function runOneTurn(params: {
    text: string;
    prevIntent: string;
    previousRecommended: EfroProduct[];
    context: SellerBrainContext;
  }) {
    const t0 = Date.now();
    let replyText = "";
    let recommended: EfroProduct[] = [];
    let nextContext: any = null;
    let nextIntent = params.prevIntent;

    if (mode === "http") {
      const out = await callSuggestHttp({
        baseUrl,
        shop,
        text: params.text,
        prevIntent: params.prevIntent,
        plan: plan.name,
        previousRecommendedIds: (params.previousRecommended || []).map((p: any) => String(p.id)).filter(Boolean),
        context: params.context,
      });
      replyText = out.replyText;
      recommended = uniqByIdOrTitle(out.recommended) as any;
      nextContext = out.nextContext ?? null;
      nextIntent = out.intent ?? params.prevIntent;
    } else {
      const brain = await runSellerBrain(
        params.text,
        params.prevIntent as any,
        productsVisible,
        plan.name,
        params.previousRecommended,
        params.context as any
      );
      replyText = fixReplyText((brain as any)?.replyText ?? "");
      recommended = uniqByIdOrTitle(normalizeProductsForBrain((brain as any)?.recommended ?? [])) as any;
      nextContext = (brain as any)?.nextContext ?? null;
      nextIntent = (brain as any)?.intent ?? params.prevIntent;
    }

    const ms = Date.now() - t0;
    return { replyText, recommended, nextContext, nextIntent, ms };
  }

  // Conversation engine
  for (let c = 1; c <= convCount; c++) {
    let previousRecommended: EfroProduct[] = [];
    let context: SellerBrainContext = { replyMode: "customer", activeCategorySlug: null } as any;
    let prevIntent = "quick_buy";

    const turnsThisConv = Math.max(convMin, Math.min(convMax, 1 + Math.floor(rng() * (convMax - convMin + 1))));

    for (let t = 1; t <= turnsThisConv; t++) {
      if (totalTurns >= targetTurns) break;
      totalTurns++;

      const { prompt, prevIntent: pi } = chooseTurnPrompt();
      prevIntent = pi || prevIntent;

      const failReasons: FailReason[] = [];
      const anchor = pickAnchorKeyword(prompt);
      if (anchor) bumpKeyword(anchor);

      try {
        const out = await runOneTurn({
          text: prompt,
          prevIntent,
          previousRecommended,
          context,
        });

        const replyText = out.replyText || "";
        const rec = (out.recommended || []).slice(0, plan.limits.maxRecommended);

        // update memory
        previousRecommended = rec;
        context =
          out.nextContext && typeof out.nextContext === "object"
            ? ({ ...context, ...out.nextContext } as any)
            : context;
        prevIntent = out.nextIntent || prevIntent;

        // checks
        const isPolicy = isPolicyPrompt(prompt);

        if (checkMojibake && detectMojibake(replyText)) failReasons.push("mojibake");
        if (checkNoOperatorHints && detectOperatorLeak(replyText)) failReasons.push("operator_hint_leak");

        if (checkPolicy && isPolicy) {
          if (rec.length > 0) failReasons.push("policy_hallucination");
          if (!safeFallbackMention(replyText)) failReasons.push("policy_hallucination");
        }

        if (checkRecoMin && !isPolicy) {
          const looksBuyish = /zeige|show|ich brauche|i need|suche|unter|max|budget|günstig|billig/i.test(prompt);
          if (looksBuyish && rec.length === 0) failReasons.push("reco_missing");
        }

        if (checkBudget && !isPolicy) {
          const b = parseBudgetEuro(prompt);
          if (b != null && rec.length > 0) {
            const viol = rec.some((p: any) => Number(p?.price ?? 0) > b);
            if (viol) failReasons.push("budget_violation");
          }
        }

        if (anchor && !isPolicy && productsVisible.some((p) => productHasAnchor(p, anchor))) {
          const recHas = rec.some((p) => productHasAnchor(p, anchor));
          if (!recHas && rec.length > 0) failReasons.push("anchor_keyword");
        }

        msArr.push(out.ms);
        logLines.push(`[TURN] conv=${c} turn=${t} ms=${out.ms} prompt=${safeJson(prompt)}`);
        logLines.push(`[REPLY] ${replyText.replace(/\s+/g, " ").slice(0, 800)}`);
        logLines.push(`[REC] ${rec.map((p: any) => `${toTitle(p)} (${Number(p?.price ?? 0)})`).join(" | ")}`);

        if (failReasons.length) {
          totalFails += 1;
          for (const r of failReasons) recordFail(r);
          const line = `✗ ${failReasons.join(",")} conv=${c} turn=${t} prompt=${prompt}`;
          console.log(line);
          logLines.push(`[FAIL] ${line}`);
          if (failFast) {
            fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
            process.exit(1);
          }
        }
      } catch (err: any) {
        totalFails += 1;
        recordFail("crash");
        const line = `✗ crash conv=${c} turn=${t} prompt=${prompt} err=${err?.message || String(err)}`;
        console.log(line);
        logLines.push(`[CRASH] ${line}`);
        if (failFast) {
          fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
          process.exit(2);
        }
      }
    }

    if (totalTurns >= targetTurns) break;
  }

  msArr.sort((a, b) => a - b);
  const avgMs = msArr.length ? Math.round(msArr.reduce((a, b) => a + b, 0) / msArr.length) : 0;
  const p95Ms = msArr.length ? msArr[Math.floor(msArr.length * 0.95)] : 0;

  const topFailReasons = Array.from(failCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const topKeywords = Array.from(keywordCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const summary = {
    totalTurns,
    totalFails,
    topFailReasons,
    topKeywords,
    avgMsPerTurn: avgMs,
    p95Ms,
    msTotal: Date.now() - started,
    logPath,
    header,
  };

  logLines.push(`[SUMMARY] ${safeJson(summary)}`);
  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");

  console.log("[HARDCORE-V2] SUMMARY", summary);
  process.exit(totalFails === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("[HARDCORE-V2] FATAL", err?.stack || String(err));
  process.exit(2);
});
