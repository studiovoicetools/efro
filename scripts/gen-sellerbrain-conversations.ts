// scripts/gen-sellerbrain-conversations.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { createClient } from "@supabase/supabase-js";

import fs from "node:fs";
import path from "node:path";

import { loadDebugProducts } from "./lib/loadDebugProducts";
import type { EfroProduct } from "../src/lib/products/mockCatalog"; // nur Typ

type ConversationTurn = {
  text: string;
  expect?: {
    minCount?: number;
    maxCount?: number;
    mustIncludeText?: string[];
    mustNotIncludeText?: string[];
  };
};

export type ConversationSpec = {
  id: string;
  title: string;
  turns: ConversationTurn[];
};

// --------------------
// deterministic RNG
// --------------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(/[;,]/g)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function safeStr(v: any): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function normalizeProduct(p: any): EfroProduct {
  // Wir bleiben tolerant – wichtig ist: title + price + category/tags
  const title = safeStr(p.title ?? p.name ?? p.handle ?? "UNNAMED_PRODUCT");
  const price = typeof p.price === "number" ? p.price : Number(String(p.price ?? "0").replace(",", ".")) || 0;
  const category = safeStr(p.category ?? p.categorySlug ?? p.product_type ?? "");
  const tags = toTags(p.tags ?? p.tag_list ?? p.keywords);
  const image_url = safeStr(p.image_url ?? p.imageUrl ?? p.image ?? "");

  return {
    ...(p as any),
    title: title as any,
    price: price as any,
    category: category as any,
    tags: tags as any,
    image_url: image_url as any,
  } as any;
}

async function loadProductsFromSupabaseForGenerator(): Promise<EfroProduct[]> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("SUPABASE_URL fehlt (oder NEXT_PUBLIC_SUPABASE_URL).");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_KEY fehlt.");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "X-Client-Info": "efro-convgen" } },
  });

  const limit = Number(process.env.EFRO_PRODUCTS_LIMIT ?? 500);
  const takeN = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);

  const res = await supabase.from("products").select("*").limit(limit);

  const data = (res as any).data as any[] | null;
  const error = (res as any).error as any;

  if (error) throw new Error(`Supabase error: ${error.message ?? JSON.stringify(error)}`);
  if (!data || !Array.isArray(data)) throw new Error("Supabase returned no data.");

  const products = data.map(normalizeProduct).filter((p) => safeStr((p as any).title).length > 0);

  // Optional: Shop-Filter, falls du ihn setzen willst
  const shopUuid = process.env.EFRO_SHOP_UUID;
  const filtered = shopUuid
    ? products.filter((p: any) => String((p as any).shop_uuid ?? (p as any).shopUuid ?? "") === String(shopUuid))
    : products;

  if (filtered.length === 0) throw new Error("0 Produkte nach Filter. Prüfe EFRO_SHOP_UUID / Tabelle / RLS.");

  // Für Varianz: shuffle + takeN
  const rng = mulberry32(Number(process.env.CONV_SEED ?? process.env.EFRO_CONV_SEED ?? "1337"));
  const list = shuffle(rng, filtered);

  console.log("[EFRO ConvGen] Loaded products", { count: list.length, source: "supabase" });
  return list.slice(0, Math.min(takeN, list.length));
}





async function loadProductsForGenerator(): Promise<EfroProduct[]> {
  const sourcePref = (process.env.EFRO_CONVGEN_SOURCE ?? "debug").toLowerCase();

  if (sourcePref === "supabase") {
    return await loadProductsFromSupabaseForGenerator();
  }

  // default: debug-products (Shopify mapped) + optional fixture fallback
  const DEBUG_PRODUCTS_URL =
    process.env.EFRO_DEBUG_PRODUCTS_URL ??
    "http://localhost:3000/api/efro/debug-products?shop=local-dev";

  const allowFixtureFallback = process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1";
  const fixturePath = process.env.EFRO_FIXTURE_PATH ?? "scripts/fixtures/products.local.json";

  console.log("[EFRO ConvGen] Loading products (api with fixture fallback)", {
    url: DEBUG_PRODUCTS_URL,
    fixturePath,
    allowFixtureFallback,
    sourcePref,
  });

  const { products, source } = await loadDebugProducts<EfroProduct[]>({
    url: DEBUG_PRODUCTS_URL,
    fixturePath,
    timeoutMs: 6000,
    allowFixtureFallback,
  });

  const arr = (products as any[]) ?? [];
  const normalized = arr.map(normalizeProduct).filter((p) => safeStr((p as any).title).length > 0);

  if (normalized.length === 0) {
    console.error("[EFRO ConvGen] ERROR: No products loaded.");
    process.exit(1);
  }

  console.log("[EFRO ConvGen] Loaded products", { count: normalized.length, source });

  const takeN = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);
  const rng = mulberry32(Number(process.env.CONV_SEED ?? process.env.EFRO_CONV_SEED ?? "1337"));
  const list = shuffle(rng, normalized);

  return list.slice(0, Math.min(takeN, list.length));
}


// --------------------
// Conversation templates (katalogtreffend)
// --------------------
function buildSingleTurnExact(p: EfroProduct): ConversationTurn {
  // Garantiert katalogtreffend, weil wir den echten Titel verwenden
  return {
    text: `Suche ${safeStr((p as any).title)} – möglichst günstig.`,
    expect: { minCount: 1 },
  };
}

function buildTwoTurn(p: EfroProduct): ConversationTurn[] {
  const title = safeStr((p as any).title);
  const tags = toTags((p as any).tags);
  const hint = tags.length ? ` (${tags[0]})` : "";

  return [
    {
      text: `Ich suche ${title}${hint}.`,
      expect: { minCount: 1 },
    },
    // Keine minCount-Expectation im Follow-up (realistisch + vermeidet falsche Härte)
    {
      text: `Gibt es etwas Ähnliches oder eine Alternative?`,
    },
  ];
}

function buildBudgetVariant(p: EfroProduct, rng: () => number): ConversationTurn {
  const title = safeStr((p as any).title);
  const price = Number((p as any).price ?? 0) || 0;

  // Budget immer >= Preis, damit minCount=1 realistisch ist
  const bump = Math.max(5, Math.round((rng() * 0.3 + 0.05) * Math.max(price, 10)));
  const budget = Math.round(price + bump);

  return {
    text: `Ich brauche ${title}, aber bitte unter ${budget}€.`,
    expect: { minCount: 1 },
  };
}

// --------------------
// Main
// --------------------
async function main() {
  // Zielgröße: unterstützt mehrere ENV-Namen (du hattest schon CONV_GEN_TARGET genutzt)
  const targetRaw =
    process.env.CONV_GEN_TARGET ??
    process.env.EFRO_CONV_TARGET ??
    process.env.CONV_TARGET ??
    "1000";

  const target = Math.max(1, Number(targetRaw) || 1000);

  const seedRaw = process.env.CONV_SEED ?? process.env.EFRO_CONV_SEED ?? "1337";
  const seed = Number(seedRaw) || 1337;
  const rng = mulberry32(seed);

  const products = await loadProductsForGenerator();

  const conversations: ConversationSpec[] = [];

  for (let i = 0; i < target; i++) {
    const p = pick(rng, products);
    const id = `conv-auto-${String(i + 1).padStart(4, "0")}`;

    // 3 Varianten rotieren (alle katalogtreffend)
    const mode = i % 3;

    if (mode === 0) {
      conversations.push({
        id,
        title: `AUTO ${id} (single)`,
        turns: [buildSingleTurnExact(p)],
      });
    } else if (mode === 1) {
      conversations.push({
        id,
        title: `AUTO ${id} (single-budget)`,
        turns: [buildBudgetVariant(p, rng)],
      });
    } else {
      conversations.push({
        id,
        title: `AUTO ${id} (two-turn)`,
        turns: buildTwoTurn(p),
      });
    }
  }

  const outDir = path.join("scripts", "conversations");
  fs.mkdirSync(outDir, { recursive: true });

  const outFile = path.join(outDir, "conv.generated1000.ts");

  const fileContent =
    `// AUTO-GENERATED by scripts/gen-sellerbrain-conversations.ts\n` +
    `// seed=${seed} target=${target}\n\n` +
    `export type ConversationTurn = { text: string; expect?: any };\n` +
    `export type ConversationSpec = { id: string; title: string; turns: ConversationTurn[] };\n\n` +
    `export const conversations: ConversationSpec[] = ${JSON.stringify(conversations, null, 2)} as any;\n`;

  fs.writeFileSync(outFile, fileContent, "utf8");

  console.log(`[EFRO ConvGen] WROTE: ${outFile} (LEN=${conversations.length})`);
  console.log(`[EFRO ConvGen] sample[0]=`, conversations[0]);
}

main().catch((e) => {
  console.error("[EFRO ConvGen] Fatal", e);
  process.exit(1);
});
