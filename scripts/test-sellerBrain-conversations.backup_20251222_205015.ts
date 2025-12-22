// scripts/test-sellerBrain-conversations.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
// Optional: falls jemand statt .env.local eine .env nutzt:
dotenv.config();

import { conversations, type ConversationSpec } from "./conversations/conv.generated1000";
import {
  runSellerBrain,
  type SellerBrainResult,
  type SellerBrainContext,
} from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog"; // nur Typ
import { createClient } from "@supabase/supabase-js";

/**
 * Conversation Runner (Supabase-Katalog)
 * - Lädt Produkte direkt aus Supabase (products Tabelle)
 * - Hat Timeout, damit sich nichts "aufhängt"
 * - Führt Multi-Turn-Kontext (intent, previousRecommended, nextContext)
 *
 * SPEED/OUTPUT:
 * - EFRO_CONV_QUIET=1            => nur FAILS + PROGRESS + DONE
 * - EFRO_CONV_CONCURRENCY=8      => Parallelität (Worker-Pool)
 * - EFRO_CONV_PROGRESS_EVERY=250 => Progress alle N Conversations (nur in QUIET)
 * - EFRO_CONV_MAX_FAILS=0        => 0 = kein Limit / sonst stoppt nach N FAILS
 * - EFRO_CONV_FAIL_FAST=1        => stoppt beim ersten FAIL (überschreibt MAX_FAILS)
 *
 * TARGET:
 * - CONV_TARGET=1000             => nur die ersten N aus conv.generated1000
 *
 * PRODUCTS:
 * - EFRO_PRODUCTS_TAKE=100
 * - EFRO_PRODUCTS_LIMIT=200
 * - EFRO_PRODUCTS_TIMEOUT_MS=12000
 * - EFRO_PRODUCTS_SHUFFLE=1
 * - EFRO_SHOP_UUID=...
 */

// ---- Output / Speed Controls (ENV) ----
const QUIET = process.env.EFRO_CONV_QUIET === "1";
const MAX_FAILS = Number(process.env.EFRO_CONV_MAX_FAILS ?? 0); // 0 = kein Limit
const FAIL_FAST = process.env.EFRO_CONV_FAIL_FAST === "1";
const CONCURRENCY = Math.max(1, Number(process.env.EFRO_CONV_CONCURRENCY ?? 1));
const PROGRESS_EVERY = Math.max(0, Number(process.env.EFRO_CONV_PROGRESS_EVERY ?? 250));

// Optional: SellerBrain-Spam-Logs in QUIET unterdrücken
const MUTE_SB_LOGS = process.env.EFRO_CONV_MUTE_SB_LOGS !== "0"; // default = true

function always(...args: any[]) {
  // eslint-disable-next-line no-console
  console.log(...args);
}
function log(...args: any[]) {
  if (!QUIET) always(...args);
}

// Stummschalten von SellerBrain-Spam-Logs (console.log/info/warn/debug) pro Turn
async function withMutedConsole<T>(fn: () => Promise<T>): Promise<T> {
  if (!QUIET || !MUTE_SB_LOGS) return fn();

  const oldLog = console.log;
  const oldInfo = console.info;
  const oldWarn = console.warn;
  const oldDebug = console.debug;

  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.debug = () => {};

  try {
    return await fn();
  } finally {
    console.log = oldLog;
    console.info = oldInfo;
    console.warn = oldWarn;
    console.debug = oldDebug;
  }
}

async function withTimeout<T>(p: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let t: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (t) clearTimeout(t);
  }
}

function toNumber(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) ? x : 0;
  }
  return 0;
}

function pick<T>(...vals: T[]): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    // häufig: "tag1, tag2"
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeProductRow(row: any): EfroProduct {
  // Wir bleiben bewusst tolerant: unterschiedliche Spaltennamen möglich.
  // Ziel: SellerBrain braucht v.a. title + price + categorySlug (oder category) + tags.
  const title = String(
    pick(row.title, row.name, row.product_title, row.handle, row.sku, "UNNAMED_PRODUCT") ?? "UNNAMED_PRODUCT",
  );

  const price = toNumber(
    pick(row.price, row.price_eur, row.min_price, row.max_price, row.base_price, row.variant_price, row.amount, 0),
  );

  const categorySlug = String(
    pick(row.category_slug, row.categorySlug, row.category, row.product_type, row.type, row.collection_slug, "") ?? "",
  );

  const category = String(pick(row.category, row.category_name, row.product_type, row.type, "") ?? "");

  const tags = normalizeTags(pick(row.tags, row.tag_list, row.keywords, row.search_tags));

  const imageUrl = String(pick(row.image_url, row.imageUrl, row.image, row.featured_image, row.preview_image, "") ?? "");

  // EfroProduct-Typ kann in deinem Repo mehr Felder haben – wir casten minimal.
  return {
    id: pick(row.id, row.uuid, row.shopify_id, row.product_id, title) as any,
    title: title as any,
    price: price as any,
    category: category as any,
    categorySlug: categorySlug as any,
    tags: tags as any,
    image_url: imageUrl as any,
  } as any;
}

async function loadProductsFromSupabase(): Promise<EfroProduct[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("SUPABASE_URL fehlt (oder NEXT_PUBLIC_SUPABASE_URL).");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY fehlt.");

  // Service-Key nur serverseitig – wir loggen ihn NICHT.
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "efro-conv-tests" } },
  });

  const limit = Number(process.env.EFRO_PRODUCTS_LIMIT ?? 200);
  const timeoutMs = Number(process.env.EFRO_PRODUCTS_TIMEOUT_MS ?? 12000);

  const q = supabase.from("products").select("*").limit(limit);
  const res = await withTimeout(q, timeoutMs, "Supabase products query");

  const data = (res as any).data as any[] | null;
  const error = (res as any).error as any;

  if (error) throw new Error(`Supabase error: ${error.message ?? JSON.stringify(error)}`);
  if (!data || !Array.isArray(data)) throw new Error("Supabase returned no data (data is null/undefined).");

  // Optional: shop_uuid filter
  const shopUuid = process.env.EFRO_SHOP_UUID;
  const filtered = shopUuid ? data.filter((r) => String(r.shop_uuid ?? r.shopUuid ?? "") === String(shopUuid)) : data;

  const products = filtered.map(normalizeProductRow).filter((p) => p && typeof (p as any).title === "string");

  // In QUIET: weniger Spam (nur 1 Zeile)
  always(
    `[EFRO Catalog] source=supabase table=products rows=${data.length} filtered=${products.length}`,
  );

  // Default: 100
  const takeN = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);

  // Optional shuffle
  const shuffle = process.env.EFRO_PRODUCTS_SHUFFLE === "1";
  const list = shuffle ? [...products].sort(() => Math.random() - 0.5) : products;

  const finalList = list.slice(0, takeN);

  always(`[EFRO Catalog] using products: ${finalList.length}`);
  if (finalList.length === 0) throw new Error("0 Produkte geladen. Prüfe products Tabelle / Filter / RLS.");

  return finalList;
}

type SessionState = {
  intent?: string;
  previousRecommended?: any[];
  context?: SellerBrainContext;
};

// Single Turn: echtes runSellerBrain (mit Supabase-Katalog)
async function runSingleTurn(input: any, state: SessionState, allProducts: EfroProduct[]): Promise<SellerBrainResult> {
  const userText: string = input?.text ?? input?.userText ?? input?.user ?? input?.prompt ?? "";
  const intent: string = (input?.intent ?? state.intent ?? "quick_buy") as string;

  const plan = input?.plan;
  const previousRecommended = input?.previousRecommended ?? state.previousRecommended;
  const context: SellerBrainContext | undefined = input?.context ?? state.context;

  if (!userText || typeof userText !== "string") {
    throw new Error("Missing userText/text in turn input");
  }

  return await runSellerBrain(userText, intent, allProducts as any, plan, previousRecommended, context);
}

function failDetails(convId: string, turnIndex: number, reason: string) {
  return `turn ${turnIndex + 1}: ${reason}`;
}

function baselineAssert(convId: string, turnIndex: number, result: any): string | null {
  if (!result) return failDetails(convId, turnIndex, "result is null/undefined");
  if (typeof result.replyText !== "string" || result.replyText.trim().length === 0) {
    return failDetails(convId, turnIndex, "replyText is empty");
  }
  if (typeof result.intent !== "string" || result.intent.trim().length === 0) {
    return failDetails(convId, turnIndex, "intent is empty");
  }
  if (!Array.isArray(result.recommended)) {
    return failDetails(convId, turnIndex, "recommended is not an array");
  }
  return null;
}

function assertTurn(convId: string, turnIndex: number, result: SellerBrainResult, expect: any) {
  if (!expect) return;

  const replyText = String((result as any).replyText ?? "");
  const recommended = Array.isArray((result as any).recommended) ? (result as any).recommended : [];
  const count = recommended.length;

  if (typeof expect.minCount === "number" && count < expect.minCount) {
    throw new Error(failDetails(convId, turnIndex, `count ${count} < minCount ${expect.minCount}`));
  }
  if (typeof expect.maxCount === "number" && count > expect.maxCount) {
    throw new Error(failDetails(convId, turnIndex, `count ${count} > maxCount ${expect.maxCount}`));
  }

  // NEW: muss bestimmte Produkttitel in recommended enthalten
  if (Array.isArray(expect.mustIncludeRecommendedTitle) && expect.mustIncludeRecommendedTitle.length > 0) {
    const titles = recommended.map((p: any) => String(p?.title ?? "").toLowerCase());
    for (const t of expect.mustIncludeRecommendedTitle) {
      const needle = String(t).toLowerCase();
      if (!titles.some((x: string) => x.includes(needle))) {
        throw new Error(failDetails(convId, turnIndex, `recommended missing title "${t}"`));
      }
    }
  }

  // NEW: max Preis der recommended Produkte darf nicht überschritten werden
  if (typeof expect.maxRecommendedPrice === "number" && recommended.length > 0) {
    const maxPrice = Math.max(...recommended.map((p: any) => Number(p?.price ?? 0)));
    if (maxPrice > expect.maxRecommendedPrice) {
      throw new Error(
        failDetails(convId, turnIndex, `maxRecommendedPrice ${maxPrice} > ${expect.maxRecommendedPrice}`),
      );
    }
  }

  if (expect.mustIncludeText) {
    for (const s of expect.mustIncludeText) {
      if (!replyText.toLowerCase().includes(String(s).toLowerCase())) {
        throw new Error(failDetails(convId, turnIndex, `reply missing "${s}"`));
      }
    }
  }

  if (expect.mustNotIncludeText) {
    for (const s of expect.mustNotIncludeText) {
      if (replyText.toLowerCase().includes(String(s).toLowerCase())) {
        throw new Error(failDetails(convId, turnIndex, `reply must NOT include "${s}"`));
      }
    }
  }
}

async function runConversation(spec: ConversationSpec, allProducts: EfroProduct[]) {
  let state: SessionState = {};
  for (let i = 0; i < spec.turns.length; i++) {
    const t: any = spec.turns[i];

    const result = await withMutedConsole(() => runSingleTurn(t, state, allProducts));

    const baseFail = baselineAssert(spec.id, i, result);
    if (baseFail) throw new Error(baseFail);

    assertTurn(spec.id, i, result, t.expect);

    // State-Update für den nächsten Turn
    state.intent = (result as any).intent ?? state.intent;
    state.previousRecommended = (result as any).recommended ?? state.previousRecommended;
    state.context = (result as any).nextContext ?? state.context;
  }
}

// Minimaler Worker-Pool (Concurrency)
async function runPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

async function main() {
  // 1) Produkte laden (Supabase)
  const allProducts = await loadProductsFromSupabase();

  // 2) Target
  const rawTarget = process.env.CONV_TARGET ?? process.env.SCENARIO_TARGET;
  const target = rawTarget ? Number(rawTarget) : undefined;
  const list = target ? conversations.slice(0, target) : conversations;

  always(
    `[EFRO ConvTest] start total=${list.length} concurrency=${CONCURRENCY} quiet=${QUIET} maxFails=${MAX_FAILS} failFast=${FAIL_FAST}`,
  );

  const started = Date.now();
  let ok = 0;
  let fail = 0;
  let done = 0;

  try {
    await runPool(list, CONCURRENCY, async (c, idx) => {
      if (FAIL_FAST && fail > 0) return;
      if (MAX_FAILS > 0 && fail >= MAX_FAILS) return;

      try {
        await runConversation(c, allProducts);
        ok++;
        if (!QUIET) always(`✅ ${c.id}: ${c.title}`);
      } catch (e: any) {
        fail++;
        always(`❌ ${c.id}: ${c.title}\n   ${e?.message ?? String(e)}`);
        process.exitCode = 1;
      } finally {
        done++;
        if (QUIET && PROGRESS_EVERY > 0 && done % PROGRESS_EVERY === 0) {
          const ms = Date.now() - started;
          always(`... progress ${done}/${list.length} (ok=${ok}, fail=${fail}) in ${ms}ms`);
        }
      }
    });
  } catch (e: any) {
    // z.B. wenn du später bewusst throwst (der Pool selbst wirft aktuell nicht)
    always(`[EFRO ConvTest] FATAL: ${e?.message ?? String(e)}`);
    process.exitCode = 1;
  }

  const ms = Date.now() - started;
  always(`\nDONE: ${ok}/${list.length} conversations passed in ${ms}ms`);
  if (process.exitCode) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
