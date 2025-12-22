// scripts/test-sellerBrain-conversations.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { conversations, type ConversationSpec } from "./conversations/conv.generated1000";
import { runSellerBrain, type SellerBrainResult, type SellerBrainContext } from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog";
import { createClient } from "@supabase/supabase-js";

/**
 * Conversation Runner (Supabase-Katalog)
 * - Lädt Produkte direkt aus Supabase (products Tabelle)
 * - Parallel (Worker-Pool) über EFRO_CONV_CONCURRENCY
 * - QUIET-Modus: nur FAILS + DONE (SellerBrain-Logs werden global unterdrückt)
 * - MAX_FAILS: optional early stop nach N fails
 * - FAIL_FAST: optional sofort beim ersten Fail stoppen
 */

// ---- Output / Speed Controls (ENV) ----
const QUIET = process.env.EFRO_CONV_QUIET === "1"; // nur FAILS + DONE
const CONCURRENCY = Math.max(1, Number(process.env.EFRO_CONV_CONCURRENCY ?? 1));
const MAX_FAILS = Math.max(0, Number(process.env.EFRO_CONV_MAX_FAILS ?? 1)); // default 1 (wie dein Output)
const FAIL_FAST = process.env.EFRO_CONV_FAIL_FAST === "1"; // optional: sofort beim ersten Fail
const PRINT_OK = !QUIET && process.env.EFRO_CONV_PRINT_OK !== "0"; // optional
const PRINT_PROGRESS_EVERY = Math.max(0, Number(process.env.EFRO_CONV_PROGRESS_EVERY ?? 0)); // z.B. 50

function out(line: string) {
  process.stdout.write(line.endsWith("\n") ? line : line + "\n");
}
function err(line: string) {
  process.stderr.write(line.endsWith("\n") ? line : line + "\n");
}

// QUIET = SellerBrain-Spam global killen (Concurrency-safe)
if (QUIET) {
  // Wir schreiben unsere eigene Ausgabe über out()/err()
  // Daher können wir ALLES am console.* stummschalten.
  // (Sonst kommen bei parallelen Turns wieder Logs durch.)
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = () => {};
  console.log = noop as any;
  console.info = noop as any;
  console.warn = noop as any;
  console.debug = noop as any;
  console.error = noop as any;
}

function ms(n: number) {
  return n;
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
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeProductRow(row: any): EfroProduct {
  const title = String(
    pick(row.title, row.name, row.product_title, row.handle, row.sku, "UNNAMED_PRODUCT") ?? "UNNAMED_PRODUCT"
  );

  const price = toNumber(
    pick(row.price, row.price_eur, row.min_price, row.max_price, row.base_price, row.variant_price, row.amount, 0)
  );

  const categorySlug = String(
    pick(row.category_slug, row.categorySlug, row.category, row.product_type, row.type, row.collection_slug, "") ?? ""
  );

  const category = String(pick(row.category, row.category_name, row.product_type, row.type, "") ?? "");

  const tags = normalizeTags(pick(row.tags, row.tag_list, row.keywords, row.search_tags));

  const imageUrl = String(pick(row.image_url, row.imageUrl, row.image, row.featured_image, row.preview_image, "") ?? "");

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

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "efro-conv-tests" } },
  });

  const limit = Number(process.env.EFRO_PRODUCTS_LIMIT ?? 500);
  const timeoutMs = Number(process.env.EFRO_PRODUCTS_TIMEOUT_MS ?? 12000);

  const q = supabase.from("products").select("*").limit(limit);
  const res = await withTimeout(q, timeoutMs, "Supabase products query");

  const data = (res as any).data as any[] | null;
  const error = (res as any).error as any;

  if (error) throw new Error(`Supabase error: ${error.message ?? JSON.stringify(error)}`);
  if (!data || !Array.isArray(data)) throw new Error("Supabase returned no data (data is null/undefined).");

  const shopUuid = process.env.EFRO_SHOP_UUID;
  const filtered = shopUuid ? data.filter((r) => String(r.shop_uuid ?? r.shopUuid ?? "") === String(shopUuid)) : data;

  const products = filtered.map(normalizeProductRow).filter((p) => p && typeof (p as any).title === "string");

  // Nur 1x ausgeben (relevant)
  out(`[EFRO Catalog] source=supabase table=products rows=${data.length} filtered=${products.length}`);

  const takeN = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);
  const shuffle = process.env.EFRO_PRODUCTS_SHUFFLE === "1";
  const list = shuffle ? [...products].sort(() => Math.random() - 0.5) : products;
  const finalList = list.slice(0, takeN);

  out(`[EFRO Catalog] using products: ${finalList.length}`);
  if (finalList.length === 0) throw new Error("0 Produkte geladen. Prüfe products Tabelle / Filter / RLS.");

  return finalList;
}

type SessionState = {
  intent?: string;
  previousRecommended?: any[];
  context?: SellerBrainContext;
};

class ConversationFail extends Error {
  convId: string;
  title: string;
  turnIndex: number;
  turnText: string;
  intent?: string;
  recommendedCount?: number;
  replySnippet?: string;

  constructor(opts: {
    convId: string;
    title: string;
    turnIndex: number;
    turnText: string;
    message: string;
    intent?: string;
    recommendedCount?: number;
    replySnippet?: string;
  }) {
    super(opts.message);
    this.convId = opts.convId;
    this.title = opts.title;
    this.turnIndex = opts.turnIndex;
    this.turnText = opts.turnText;
    this.intent = opts.intent;
    this.recommendedCount = opts.recommendedCount;
    this.replySnippet = opts.replySnippet;
  }
}

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
  return `${convId}: turn ${turnIndex + 1}: ${reason}`;
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
  const count = Array.isArray((result as any).recommended) ? (result as any).recommended.length : 0;

  if (typeof expect.minCount === "number" && count < expect.minCount) {
    throw new Error(failDetails(convId, turnIndex, `count ${count} < minCount ${expect.minCount}`));
  }
  if (typeof expect.maxCount === "number" && count > expect.maxCount) {
    throw new Error(failDetails(convId, turnIndex, `count ${count} > maxCount ${expect.maxCount}`));
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
    const turnText: string = String(t?.text ?? t?.userText ?? t?.prompt ?? "");

    let result: SellerBrainResult | null = null;
    try {
      result = await runSingleTurn(t, state, allProducts);

      const baseFail = baselineAssert(spec.id, i, result);
      if (baseFail) {
        throw new Error(baseFail);
      }

      assertTurn(spec.id, i, result, t.expect);

      // State-Update für den nächsten Turn
      state.intent = (result as any).intent ?? state.intent;
      state.previousRecommended = (result as any).recommended ?? state.previousRecommended;
      state.context = (result as any).nextContext ?? state.context;
    } catch (e: any) {
      const intent = (result as any)?.intent;
      const recommendedCount = Array.isArray((result as any)?.recommended) ? (result as any).recommended.length : undefined;
      const replyText = String((result as any)?.replyText ?? "");
      const replySnippet = replyText.length > 220 ? replyText.slice(0, 220) + "…" : replyText;

      throw new ConversationFail({
        convId: spec.id,
        title: spec.title,
        turnIndex: i,
        turnText,
        message: e?.message ?? String(e),
        intent,
        recommendedCount,
        replySnippet,
      });
    }
  }
}

async function main() {
  // 1) Produkte laden
  const allProducts = await loadProductsFromSupabase();

  // 2) Target
  const rawTarget = process.env.CONV_TARGET ?? process.env.SCENARIO_TARGET;
  const target = rawTarget ? Number(rawTarget) : undefined;
  const list = target ? conversations.slice(0, target) : conversations;

  const started = Date.now();
  let ok = 0;
  let fails = 0;
  let stopped = false;

  // progress
  let done = 0;
  const total = list.length;

  out(
    `[EFRO ConvTest] start total=${total} concurrency=${CONCURRENCY} quiet=${QUIET} maxFails=${MAX_FAILS} failFast=${FAIL_FAST}`
  );

  // Worker-Pool
  let idx = 0;
  const next = () => {
    if (stopped) return null;
    if (idx >= total) return null;
    const c = list[idx];
    idx++;
    return c;
  };

  async function worker(workerId: number) {
    for (;;) {
      const c = next();
      if (!c) return;

      try {
        await runConversation(c, allProducts);
        ok++;
        if (PRINT_OK) out(`✅ ${c.id}: ${c.title}`);
      } catch (e: any) {
        fails++;
        process.exitCode = 1;

        if (e instanceof ConversationFail) {
          err(`❌ ${e.convId}: ${e.title}`);
          err(`   turn ${e.turnIndex + 1}: ${e.message}`);
          err(`   text: ${e.turnText}`);
          if (e.intent) err(`   intent: ${e.intent}`);
          if (typeof e.recommendedCount === "number") err(`   recommended: ${e.recommendedCount}`);
          if (e.replySnippet) err(`   reply: ${e.replySnippet}`);
        } else {
          err(`❌ ${c.id}: ${c.title}`);
          err(`   ${e?.message ?? String(e)}`);
        }

        // Stop-Logik
        if (FAIL_FAST) stopped = true;
        if (MAX_FAILS > 0 && fails >= MAX_FAILS) stopped = true;
      } finally {
        done++;
        if (!QUIET && PRINT_PROGRESS_EVERY > 0 && done % PRINT_PROGRESS_EVERY === 0) {
          out(`[EFRO ConvTest] progress ${done}/${total} ok=${ok} fails=${fails}`);
        }
      }

      if (stopped) return;
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  const durMs = Date.now() - started;
  out(`\nDONE: ${ok}/${total} conversations passed in ${durMs}ms`);

  if (process.exitCode) process.exit(1);
}

main().catch((e) => {
  err(String(e?.stack ?? e?.message ?? e));
  process.exit(1);
});
