/**
 * EFRO Hardcore v2 (SMOKE)
 * Goal: Stress-test SellerBrain with catalog realism + chaos + multi-turn memory.
 *
 * RUN:
 *   pnpm -s tsx scripts/test-hardcore-v2.ts
 *
 * Requirements:
 * - deterministic RNG via HARDCORE_SEED (default 1337)
 * - load products from http://localhost:3000/api/efro/debug-products?shop=local-dev
 * - step-by-step workflow: no business logic changes, only this test file
 * - logs under logs/ and fails csv
 * - robust extractors: pickReplyText, pickRecommended, extractNextContext
 */

import fs from "node:fs";
import path from "node:path";

import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog";
import type { SellerBrainContext } from "../src/lib/sales/brain/types";

type AnyObj = Record<string, any>;

type PlanName = "starter";
type PlanLimits = { maxRecommended: number };

type SmokeCaseKind =
  | "product_query"
  | "category_query"
  | "budget_query"
  | "mixed_language"
  | "typo"
  | "conflict"
  | "long_turn"
  | "null_catalog";

type SmokeCase = {
  id: string;
  kind: SmokeCaseKind;
  prompt: string;
  expectedMinCount: number; // used for non-null catalog scenarios
  allowZero?: boolean; // for edge cases where 0 is acceptable
};

type TurnResult = {
  ok: boolean;
  id: string;
  kind: SmokeCaseKind;
  prompt: string;
  replyText: string;
  recommendedCount: number;
  recommendedTitles: string[];
  failReason?: string;
};

function ensureDir(p: string) {
  fs.mkdirSync(p, { recursive: true });
}

function nowStamp() {
  // YYYYMMDD-HHMMSS in local time
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

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function safeJson(v: any) {
  try {
    return JSON.stringify(v);
  } catch {
    return '"<unstringifiable>"';
  }
}

function pickReplyText(outer: any): string {
  // Try common shapes first
  const candidates = [
    outer?.replyText,
    outer?.reply,
    outer?.text,
    outer?.message,
    outer?.result?.replyText,
    outer?.result?.reply,
    outer?.result?.text,
    outer?.result?.message,
    outer?.result?.final?.replyText,
    outer?.result?.final?.reply,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }

  // Some engines store it under result.reply.text
  const deep = outer?.result?.reply?.text;
  if (typeof deep === "string" && deep.trim().length > 0) return deep.trim();

  return "";
}

function asArray(v: any): any[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  // sometimes items live under {items: []}
  if (Array.isArray(v?.items)) return v.items;
  return [];
}

function pickRecommended(outer: any): any[] {
  // Try multiple paths; always return an array.
  const paths = [
    outer?.result?.recommendations?.items,
    outer?.result?.recommendations,
    outer?.result?.products,
    outer?.recommended,
    outer?.products,
    outer?.finalProducts,
    outer?.result?.finalProducts,
    outer?.result?.recommended,
  ];
  for (const p of paths) {
    const a = asArray(p);
    if (a.length) return a;
  }
  // If we saw an explicit empty array in any slot, allow returning empty.
  for (const p of paths) {
    if (Array.isArray(p) && p.length === 0) return p;
    if (p && Array.isArray(p?.items) && p.items.length === 0) return p.items;
  }
  return [];
}

function extractNextContext(prev: SellerBrainContext | undefined, outer: any): SellerBrainContext | undefined {
  const candidate =
    outer?.result?.meta?.nextContext ??
    outer?.result?.nextContext ??
    outer?.nextContext ??
    undefined;

  // If candidate is a non-empty object, use it; else fallback to prev.
  if (candidate && typeof candidate === "object") return candidate as SellerBrainContext;
  return prev;
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

async function fetchJson(url: string): Promise<any> {
  // Node 20 has global fetch
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

async function loadProductsFromDebug(shop = "local-dev"): Promise<EfroProduct[]> {
  const url = `http://localhost:3000/api/efro/debug-products?shop=${encodeURIComponent(shop)}`;
  const data = await fetchJson(url);

  // debug-products might be { ok, shop, count, products } or directly an array
  const products = Array.isArray(data) ? data : (data?.products ?? data?.items ?? []);
  if (!Array.isArray(products)) throw new Error(`Unexpected products shape from debug-products: ${safeJson(data).slice(0, 300)}...`);
  return products as EfroProduct[];
}

function buildSmokeCases(rng: () => number, products: EfroProduct[]): SmokeCase[] {
  const titles = products
    .map((p) => String((p as any)?.title ?? "").trim())
    .filter((t) => t.length >= 4);

  const sampleTitle = () => (titles.length ? pick(rng, titles) : "parfum");

  const base: SmokeCase[] = [
    { id: "p1", kind: "product_query", prompt: `Zeige mir ${sampleTitle()}`, expectedMinCount: 1 },
    { id: "p2", kind: "product_query", prompt: `Ich suche ${sampleTitle()} unter 50€`, expectedMinCount: 1 },
    { id: "c1", kind: "category_query", prompt: `Zeig mir Parfum.`, expectedMinCount: 1 },
    { id: "c2", kind: "category_query", prompt: `Ich brauche was aus der Kategorie Kosmetik, bitte.`, expectedMinCount: 1 },
    { id: "b1", kind: "budget_query", prompt: `Budget 30€, was passt?`, expectedMinCount: 1, allowZero: true },
    { id: "b2", kind: "budget_query", prompt: `Ich will was GÜNSTIGES, max 20 Euro.`, expectedMinCount: 1 },
    { id: "m1", kind: "mixed_language", prompt: `I need a cheap perfume, unter 25€`, expectedMinCount: 1 },
    { id: "m2", kind: "mixed_language", prompt: `show me something nice for my wife, budget 40€, Parfum`, expectedMinCount: 1 },
    { id: "t1", kind: "typo", prompt: `zeige mir parfmu unter 30`, expectedMinCount: 1 },
    { id: "t2", kind: "typo", prompt: `kosmetk geschenk set billig`, expectedMinCount: 1, allowZero: true },
    { id: "x1", kind: "conflict", prompt: `Ich will Premium Parfum aber super billig (max 10€).`, expectedMinCount: 1, allowZero: true },
    { id: "l1", kind: "long_turn", prompt: `Ich brauche ein Geschenk. Erstens: günstig. Zweitens: für eine Frau. Drittens: eher Duft. Aber bitte kein sehr süßer Duft. Was hast du?`, expectedMinCount: 1 },
  ];

  // Add a null-catalog scenario (we'll override products for this one)
  base.push({
    id: "n1",
    kind: "null_catalog",
    prompt: `Zeige mir Parfum unter 30€`,
    expectedMinCount: 0,
    allowZero: true,
  });

  // Randomize order but keep null-catalog near end
  const withoutNull = base.filter((c) => c.kind !== "null_catalog");
  const nulls = base.filter((c) => c.kind === "null_catalog");
  const shuffled = shuffle(rng, withoutNull);
  return [...shuffled, ...nulls];
}

function starterPlan(): { name: PlanName; limits: PlanLimits } {
  return { name: "starter", limits: { maxRecommended: 2 } };
}

function isNullCatalogCase(c: SmokeCase) {
  return c.kind === "null_catalog";
}

function safeFallbackMention(replyText: string) {
  const t = replyText.toLowerCase();
  // We accept any safe fallback phrasing: "kann ich nicht", "habe keine daten", "bitte im shop prüfen", etc.
  const needles = [
    "kann ich nicht",
    "kann das nicht",
    "nicht verifizieren",
    "habe keine",
    "keine produkte",
    "bitte im shop",
    "bitte prüf",
    "bitte prüfen",
    "leider",
  ];
  return needles.some((n) => t.includes(n));
}

async function main() {
  const seed = Number(process.env.HARDCORE_SEED ?? "1337") || 1337;
  const rng = mulberry32(seed);

  const logsDir = path.resolve(process.cwd(), "logs");
  ensureDir(logsDir);

  const stamp = nowStamp();
  const logPath = path.join(logsDir, `hardcore-v2-smoke-${stamp}.log`);
  const failsCsvPath = path.join(logsDir, `hardcore-v2-smoke-fails-${stamp}.csv`);

  const plan = starterPlan();

  const logLines: string[] = [];
  const failRows: string[] = ["id,kind,prompt,reason,recommendedCount,replyPreview"];

  const started = Date.now();

  // Load products from debug-products
  const allProducts = await loadProductsFromDebug("local-dev");

  const smokeCases = buildSmokeCases(rng, allProducts);

  // Multi-turn memory: previousRecommended + context carried forward
  let previousRecommended: any[] = [];
  let context: SellerBrainContext | undefined = { activeCategorySlug: null } as any;

  const results: TurnResult[] = [];

  // Helper to run one turn
  async function runTurn(c: SmokeCase, productsOverride?: EfroProduct[]) {
    const products = productsOverride ?? allProducts;

    // IMPORTANT: runSellerBrain expects positional args (see src/lib/sales/sellerBrain.ts)
      const intent: any = "explore";
      const outer = await runSellerBrain(
        c.prompt,
        intent,
        products,
        plan.name,
        previousRecommended as any,
        context as any
      );

    const replyText = pickReplyText(outer);
    const recommendedRaw = pickRecommended(outer);
    const recommended = uniqByIdOrTitle(recommendedRaw);

    // Update multi-turn state
    context = extractNextContext(context, outer);
    previousRecommended = recommended;

    const recommendedTitles = recommended.map(toTitle).filter(Boolean).slice(0, 10);

    // Assertions
    let ok = true;
    let failReason = "";

    if (!replyText || replyText.trim().length === 0) {
      ok = false;
      failReason = "replyText empty";
    }

    if (recommended.length > plan.limits.maxRecommended) {
      ok = false;
      failReason = `plan max exceeded: ${recommended.length} > ${plan.limits.maxRecommended}`;
    }

    if (isNullCatalogCase(c)) {
      if (recommended.length !== 0) {
        ok = false;
        failReason = `null-catalog must recommend 0, got ${recommended.length}`;
      }
      if (!safeFallbackMention(replyText)) {
        ok = false;
        failReason = `null-catalog reply not safe fallback (missing disclaimer)`;
      }
    } else {
      if (!c.allowZero && recommended.length < c.expectedMinCount) {
        ok = false;
        failReason = `expectedMinCount ${c.expectedMinCount} not met (got ${recommended.length})`;
      }
    }

    const tr: TurnResult = {
      ok,
      id: c.id,
      kind: c.kind,
      prompt: c.prompt,
      replyText,
      recommendedCount: recommended.length,
      recommendedTitles,
      ...(ok ? {} : { failReason }),
    };

    results.push(tr);

    // logging
    logLines.push(
      `[TURN] ${c.id} kind=${c.kind} ok=${ok} rec=${recommended.length} prompt=${safeJson(c.prompt)}`
    );
    logLines.push(`[REPLY] ${replyText.replace(/\s+/g, " ").slice(0, 500)}`);
    logLines.push(`[REC] ${recommendedTitles.join(" | ")}`);

    if (!ok) {
      const preview = replyText.replace(/\s+/g, " ").slice(0, 140).replaceAll('"', '""');
      failRows.push(
        `"${c.id}","${c.kind}","${c.prompt.replaceAll('"', '""')}","${failReason.replaceAll('"', '""')}",${recommended.length},"${preview}"`
      );
    }
  }

  // Execute SMOKE cases, including a null-catalog turn at the end.
  for (const c of smokeCases) {
    if (c.kind === "null_catalog") {
      await runTurn(c, []); // override with empty catalog
    } else {
      await runTurn(c);
    }
  }

  const total = results.length;
  const fail = results.filter((r) => !r.ok).length;
  const pass = total - fail;
  const passRate = total ? (pass / total).toFixed(4) : "0.0000";
  const msTotal = Date.now() - started;

  // Persist logs
  fs.writeFileSync(logPath, logLines.join("\n") + "\n", "utf8");
  fs.writeFileSync(failsCsvPath, failRows.join("\n") + "\n", "utf8");

  const summary = {
    mode: "SMOKE",
    seed,
    plan: plan.name,
    total,
    pass,
    fail,
    passRate,
    msTotal,
    log: path.relative(process.cwd(), logPath),
    failsCsv: path.relative(process.cwd(), failsCsvPath),
  };

  console.log(`[HARDCORE-V2] DONE ${JSON.stringify(summary)}`);
  if (fail === 0) {
    console.log(`[HARDCORE-V2] SMOKE GREEN. ExitCode=0`);
    process.exit(0);
  } else {
    console.log(`[HARDCORE-V2] SMOKE NOT GREEN. ExitCode=1`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[HARDCORE-V2] FATAL", err?.stack || String(err));
  process.exit(2);
});
