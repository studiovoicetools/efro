// scripts/gen-sellerbrain-conversations.ts
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Output: scripts/conversations/conv.generated1000.ts
type TurnExpect = {
  minCount?: number;
  // Hardcore: bei titel-spezifischen Queries muss ein ?? genau diesen Titel enthalten
  mustIncludeProductTitle?: string;
  // Optional: Encoding-Muell vermeiden (mojibake-guard) (mojibake-guard)
  mustNotIncludeText?: string[];
};

type TurnSpec = {
  text: string;
  expect?: TurnExpect;
};

export type ConversationSpec = {
  id: string;
  title: string;
  turns: TurnSpec[];
};

type EfroProduct = {
  id: any;
  sku?: string | null;
  title: string;
  price?: number | null;
  category?: string | null;
  categorySlug?: string | null;
  tags?: string[] | string | null;
  image_url?: string | null;
};

function num(v: any): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const x = Number(v.replace(",", "."));
    return Number.isFinite(x) ? x : null;
  }
  return null;
}

function normalizeTags(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function normalizeProductRow(row: any): EfroProduct {
  const title = String(row.title ?? row.name ?? row.product_title ?? row.handle ?? row.sku ?? "UNNAMED_PRODUCT");
  const price = num(row.price ?? row.price_eur ?? row.min_price ?? row.base_price ?? row.variant_price ?? row.amount);
  const categorySlug = String(row.category_slug ?? row.categorySlug ?? row.category ?? row.product_type ?? row.type ?? "");
  const category = String(row.category ?? row.category_name ?? row.product_type ?? row.type ?? "");
  const tags = normalizeTags(row.tags ?? row.tag_list ?? row.keywords ?? row.search_tags);
  const imageUrl = String(row.image_url ?? row.imageUrl ?? row.image ?? row.featured_image ?? row.preview_image ?? "");
  return {
    id: row.id ?? row.uuid ?? row.shopify_id ?? row.product_id ?? title,
    sku: row.sku ?? null,
    title,
    price,
    category,
    categorySlug,
    tags,
    image_url: imageUrl,
  };
}

// ---------------------- Seeded RNG (deterministic) ----------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickOne<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function maybe(r: () => number, p: number) {
  return r() < p;
}

function shuffleInPlace<T>(r: () => number, a: T[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

// ---------------------- "Realistische Noise" ----------------------
// Ziel: schwer, aber nicht Fantasy. Keine komplett unverst?ndliche CH-Schriftdeutsch-Phantasie.
// Wir mischen: Schweizer Hochdeutsch + einzelne Dialekt-W?rter + Tippfehler + Slang + Nicht-Muttersprachler.

const SWISS_WORDS: Array<[RegExp, string]> = [
  [/\bich\b/gi, "i"],
  [/\bnicht\b/gi, "n?d"],
  [/\bkein\b/gi, "kei"],
  [/\beinen\b/gi, "en"],
  [/\beine\b/gi, "e"],
  [/\betwas\b/gi, "?pis"],
  [/\bhast du\b/gi, "hesch du"],
  [/\bkannst du\b/gi, "chasch du"],
  [/\bguenstig\b/gi, "g?nschtig"],
  [/\bbitte\b/gi, "bitte"],
  [/\bdanke\b/gi, "merci"],
  [/\beuro\b/gi, "Fr."], // bewusst CH-typisch, auch wenn Shop EUR hat -> das soll Robustheit testen
];

function stripUmlauts(s: string) {
  return s
    .replace(/\\u00e4/g, "ae").replace(/\\u00f6/g, "oe").replace(/\\u00fc/g, "ue")
    .replace(/\\u00c4/g, "Ae").replace(/\\u00d6/g, "Oe").replace(/\\u00dc/g, "Ue")
    .replace(/\\u00df/g, "ss");
}

function isOutOfStockProduct(p: any): boolean {
  const status = String(p?.availability_status ?? p?.availabilityStatus ?? "").toLowerCase();
  if (status === "out_of_stock") return true;

  const title = String(p?.title ?? "").toLowerCase();

  const tagsNorm = Array.isArray(p?.tags_norm)
    ? p.tags_norm.map((x: any) => String(x).toLowerCase())
    : [];

  const tags = Array.isArray(p?.tags)
    ? p.tags.map((x: any) => String(x).toLowerCase())
    : [];

  return (
    title.includes("out of stock") ||
    tagsNorm.includes("outofstock") ||
    tagsNorm.includes("out-of-stock") ||
    tags.includes("outofstock") ||
    tags.includes("out-of-stock")
  );
}

function isStrictExpectProduct(p: any): boolean {
  // Für diese Produkte erzwingen wir KEIN mustIncludeProductTitle (wie bei out_of_stock)
  if (isOutOfStockProduct(p)) return false;

  const title = String(p?.title ?? "").toLowerCase();
  const tagsNorm = Array.isArray(p?.tags_norm)
    ? p.tags_norm.map((x: any) => String(x).toLowerCase())
    : [];

  // Platzhalter/Placeholder/Test-„Dummy“: nicht als harte Erwartung testen
  if (title.includes("platzhalter") || title.includes("placeholder")) return false;
  if (tagsNorm.includes("platzhalter") || tagsNorm.includes("placeholder")) return false;

  return true;
}

function addTypos(r: () => number, s: string) {
  // nur leichte echte Tippfehler, nicht zerst?ren
  const chars = s.split("");
  const ops = clamp(Math.floor(r() * 2), 0, 1); // 0-1 Operation
  for (let k = 0; k < ops; k++) {
    const i = Math.floor(r() * chars.length);
    if (i <= 1 || i >= chars.length - 2) continue;
    const mode = Math.floor(r() * 3);
    if (mode === 0) {
      // delete
      chars.splice(i, 1);
    } else if (mode === 1) {
      // swap
      [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    } else {
      // duplicate
      chars.splice(i, 0, chars[i]);
    }
  }
  return chars.join("");
}

function nonNativeSimplify(r: () => number, s: string) {
  // typisch: Artikel weg, kurze S?tze, falsche F?lle
  // aber Kernw?rter bleiben drin
  let out = s;
  out = out.replace(/\b(der|die|das|den|dem|des|ein|eine|einen|einem)\b/gi, "");
  out = out.replace(/\s{2,}/g, " ").trim();
  if (maybe(r, 0.35)) out = out.replace(/\?+$/g, "");
  if (maybe(r, 0.25)) out = out + " pls";
  return out;
}

function youthSlang(r: () => number, s: string) {
  const prefixes = ["yo", "digga", "bruder", "safe", "kurz"];
  const suffixes = ["thx", "danke dir", "kuss", "lol"];
  let out = s;
  if (maybe(r, 0.35)) out = `${pickOne(r, prefixes)} ${out}`;
  if (maybe(r, 0.25)) out = `${out} ${pickOne(r, suffixes)}`;
  if (maybe(r, 0.25)) out = out.replace(/\bbitte\b/gi, "");
  return out;
}

type NoiseStyle = "clean" | "swiss" | "non_native" | "slang" | "typo" | "ascii";

function applyNoise(r: () => number, text: string, style: NoiseStyle) {
  let out = text;

  if (style === "clean") return out;

  if (style === "ascii") out = stripUmlauts(out);
  if (style === "typo") out = addTypos(r, out);

  if (style === "swiss") {
    for (const [re, rep] of SWISS_WORDS) out = out.replace(re, rep);
    if (maybe(r, 0.35)) out = stripUmlauts(out);
    if (maybe(r, 0.25)) out = addTypos(r, out);
  }

  if (style === "non_native") {
    if (maybe(r, 0.60)) out = stripUmlauts(out);
    out = nonNativeSimplify(r, out);
    if (maybe(r, 0.25)) out = addTypos(r, out);
  }

  if (style === "slang") {
    out = youthSlang(r, out);
    if (maybe(r, 0.30)) out = stripUmlauts(out);
    if (maybe(r, 0.20)) out = addTypos(r, out);
  }

  // kleine Emoji-Chance (realistisch)
  if (maybe(r, 0.18)) out = out + (maybe(r, 0.5) ? " g???" : " g???");

  // normalize spaces
  out = out.replace(/\s{2,}/g, " ").trim();
  return out;
}

// ---------------------- Conversation Templates (Hard) ----------------------
function buildSingleTitleQuery(r: () => number, p: EfroProduct) {
  const variants = [
    `Suche ${p.title} ? EUR? m?glichst guenstig.`,
    `Ich brauche ${p.title}, bitte preiswert.`,
    `Hast du ${p.title}?`,
    `Ich will ${p.title}, aber guenstig.`,
    `Brauche ${p.title} jetzt.`,
  ];
  return pickOne(r, variants);
}

function buildSingleCategoryQuery(r: () => number, categoryLabel: string) {
  const variants = [
    `Ich suche etwas aus ${categoryLabel} ? EUR? m?glichst guenstig.`,
    `Zeig mir ${categoryLabel} Produkte, bitte preiswert.`,
    `Was hast du im Bereich ${categoryLabel}?`,
    `Ich brauche ${categoryLabel}, aber nicht zu teuer.`,
  ];
  return pickOne(r, variants);
}

function buildFollowupAlternative(r: () => number, p: EfroProduct, categoryHint: string | null) {
  const cat = categoryHint ? ` (${categoryHint})` : "";
  const variants = [
    `Gibt es etwas ?hnliches oder eine Alternative zu ${p.title}${cat}?`,
    `Hesch ?pis ?hnliches zu ${p.title}${cat}?`,
    `Alternative f?r ${p.title}${cat} bitte.`,
    `Was w?re ?hnlich wie ${p.title}${cat}?`,
  ];
  return pickOne(r, variants);
}

function buildFollowupCheaper(r: () => number, p: EfroProduct, max: number) {
  const variants = [
    `Geht das auch guenstiger? Max ${max} EUR.`,
    `Hesch es billiger? so um ${max} EUR.`,
    `Kannst du was unter ${max} EUR zeigen?`,
    `unter ${max} euro bitte`,
  ];
  return pickOne(r, variants);
}

function buildFollowupConstraint(r: () => number, p: EfroProduct) {
  const variants = [
    `Wichtig: bitte kein Premium, eher guenstig.`,
    `bitte nix teures, eher budget.`,
    `soll robust sein, aber preis ok.`,
    `Ich verstehe nicht gut deutsch, nur guenstig und einfach ok?`,
  ];
  return pickOne(r, variants);
}

function garbledEncodingGuards(): string[] {
  // Das sind typische UTF-8/CP1252-Muellzeichen. Wenn das auftaucht, ist live mega unprofessionell.
  return ["?", "? EUR? EUR?", "? EUR?", "? EUR", "?"];
}

function chooseNoiseStyle(r: () => number): NoiseStyle {
  const roll = r();
  // Mischung: viel "schwieriger", aber noch realistisch
  if (roll < 0.25) return "clean";
  if (roll < 0.45) return "non_native";
  if (roll < 0.65) return "swiss";
  if (roll < 0.80) return "slang";
  if (roll < 0.90) return "ascii";
  return "typo";
}

function bestBudgetNear(r: () => number, p: EfroProduct) {
  const base = (p.price ?? 50) as number;
  const factor = 0.65 + r() * 0.25; // 0.65 - 0.90
  const max = Math.max(10, Math.round(base * factor));
  return max;
}

function safeCategoryHint(p: EfroProduct) {
  const c = (p.categorySlug || p.category || "").toString().trim();
  if (!c) return null;
  // wir wollen eher die echten Shop-Kategorien nutzen (deine sind z.B. sport/haushalt/...)
  return c;
}

function buildHardConversations(products: EfroProduct[], target: number, seed: number): ConversationSpec[] {
  const r = mulberry32(seed);

  const list = [...products].filter(p => p && p.title && typeof p.title === "string");
  if (list.length < 10) throw new Error(`Too few products for convgen: ${list.length}`);

  // Index categories for category-only queries
  const byCategory = new Map<string, EfroProduct[]>();
  for (const p of list) {
    const key = (p.categorySlug || p.category || "").toString().trim();
    if (!key) continue;
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key)!.push(p);
  }
  const categories = Array.from(byCategory.keys());

  const multiTurnRatio = Number(process.env.EFRO_CONVGEN_MULTITURN_RATIO ?? 0.55); // default: viele multi-turn
  const noiseRatio = Number(process.env.EFRO_CONVGEN_NOISE_RATIO ?? 0.80); // default: viel noise
  const strictEncoding = process.env.EFRO_CONVGEN_STRICT_ENCODING !== "0"; // default true

  const convs: ConversationSpec[] = [];
  for (let i = 0; i < target; i++) {
    const id = `conv-auto-${String(i + 1).padStart(4, "0")}`;

    const isMulti = maybe(r, multiTurnRatio);
    const style = maybe(r, noiseRatio) ? chooseNoiseStyle(r) : "clean";

    if (!isMulti) {
      // Single: 70% title-specific (h?rter, weil wir Titel-Match assertieren)
      const titleSpecific = maybe(r, 0.70);
      if (titleSpecific) {
        const p = pickOne(r, list);
        let t1 = buildSingleTitleQuery(r, p);
        t1 = applyNoise(r, t1, style);

        convs.push({
          id,
          title: `AUTO ${id} (single-hard/${style})`,
          turns: [
            {
              text: t1,
              expect: {
                minCount: 1,
                ...(isStrictExpectProduct(p) ? { mustIncludeProductTitle: p.title } : {}),
                ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
              },
            },
          ],
        });
      } else {
        const cat = categories.length ? pickOne(r, categories) : "haushalt";
        let t1 = buildSingleCategoryQuery(r, cat);
        t1 = applyNoise(r, t1, style);

        convs.push({
          id,
          title: `AUTO ${id} (single-cat/${style})`,
          turns: [
            {
              text: t1,
              expect: {
                minCount: 1,
                ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
              },
            },
          ],
        });
      }
      continue;
    }

    // Multi-turn: wir halten es realistisch, aber ? EUR?stressig? EUR?:
    // Turn1: konkreter Titel
    // Turn2: Alternative/?hnlich (mit Titel+Kategorie-Hint -> damit SellerBrain nicht ins Leere l?uft)
    // Turn3: Budget-Constraint (unter X)
    const p = pickOne(r, list);
    const catHint = safeCategoryHint(p);
    const max = bestBudgetNear(r, p);

    let t1 = buildSingleTitleQuery(r, p);
    let t2 = maybe(r, 0.55) ? buildFollowupAlternative(r, p, catHint) : buildFollowupConstraint(r, p);
    let t3 = buildFollowupCheaper(r, p, max);

    t1 = applyNoise(r, t1, style);
    t2 = applyNoise(r, t2, style);
    t3 = applyNoise(r, t3, style);

    // Optional 4. Turn: "ok nimm guenstigste von den gezeigten" (realistisch)
    const addT4 = maybe(r, 0.35);
    let t4 = `Okay, nimm bitte das guenstigste davon.`;
    if (addT4) t4 = applyNoise(r, t4, style);

    const turns: TurnSpec[] = [
      {
        text: t1,
        expect: {
          minCount: 1,
          ...(isStrictExpectProduct(p) ? { mustIncludeProductTitle: p.title } : {}),
          ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
        },
      },
      {
        text: t2,
        expect: {
          minCount: 1,
          ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
        },
      },
      {
        text: t3,
        expect: {
          minCount: 1,
          ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
        },
      },
    ];

    if (addT4) {
      turns.push({
        text: t4,
        expect: {
          minCount: 1,
          ...(strictEncoding ? { mustNotIncludeText: garbledEncodingGuards() } : {}),
        },
      });
    }

    convs.push({
      id,
      title: `AUTO ${id} (multi-hard/${style})`,
      turns,
    });
  }

  return convs;
}

// ---------------------- Load Products ----------------------
async function loadProducts(): Promise<{ products: EfroProduct[]; source: string }> {
  const source = (process.env.EFRO_CONVGEN_SOURCE ?? "").toLowerCase().trim();

  if (source === "supabase") {
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url) throw new Error("SUPABASE_URL fehlt (oder NEXT_PUBLIC_SUPABASE_URL).");
    if (!key) throw new Error("SUPABASE_SERVICE_KEY fehlt.");

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "X-Client-Info": "efro-convgen-hard" } },
    });

    const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);
    const limit = Math.max(take, Number(process.env.EFRO_PRODUCTS_LIMIT ?? 200));

    const res = await supabase.from("products").select("*").limit(limit);
    if (res.error) throw new Error(`Supabase error: ${res.error.message}`);
    const rows = (res.data ?? []) as any[];
    const mapped = rows.map(normalizeProductRow);

    // optional shop filter
    const shopUuid = process.env.EFRO_SHOP_UUID;
    const filtered = shopUuid
      ? mapped.filter((p: any) => String((p as any).shop_uuid ?? (p as any).shopUuid ?? "") === String(shopUuid))
      : mapped;

    const final = filtered.filter(p => p.title && typeof p.title === "string").slice(0, take);
    return { products: final, source: "supabase" };
  }

  // default: debug-products url with optional fixture fallback (wie bisher)
  const debugUrl =
    process.env.EFRO_DEBUG_PRODUCTS_URL || "http://localhost:3000/api/efro/debug-products?shop=local-dev";
  const fixturePath = process.env.EFRO_CONVGEN_FIXTURE_PATH || "scripts/fixtures/products.local.json";
const allowFixtureFallback = (process.env.EFRO_CONVGEN_ALLOW_FIXTURE_FALLBACK ?? "1") !== "0";
  const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? 100);

  console.log("[EFRO ConvGen] Loading products (api with fixture fallback)", {
    url: debugUrl,
    fixturePath,
    allowFixtureFallback,
  });

  try {
    const r = await fetch(debugUrl);
    const j = await r.json();
    const arr = (j?.products ?? j ?? []) as any[];
    const mapped = arr.map(normalizeProductRow).slice(0, take);
    return { products: mapped, source: "debug-products" };
  } catch (e: any) {
    if (!allowFixtureFallback) throw e;
    const abs = path.resolve(process.cwd(), fixturePath);
    const raw = fs.readFileSync(abs, "utf8");
    const json = JSON.parse(raw);
    const arr = (json?.products ?? json ?? []) as any[];
    const mapped = arr.map(normalizeProductRow).slice(0, take);
    return { products: mapped, source: "fixture" };
  }
}

// ---------------------- Write Output ----------------------
function writeTsFile(outPath: string, conversations: ConversationSpec[]) {
  const header = `/* AUTO-GENERATED FILE. DO NOT EDIT.
   Generated by scripts/gen-sellerbrain-conversations.ts
   LEN=${conversations.length}
*/\n\n`;

  const body =
    `export type ConversationSpec = {\n` +
    `  id: string;\n` +
    `  title: string;\n` +
    `  turns: { text: string; expect?: any }[];\n` +
    `};\n\n` +
    `export const conversations: ConversationSpec[] = ${JSON.stringify(conversations, null, 2)} as any;\n`;

  fs.writeFileSync(outPath, header + body, "utf8");
}

async function main() {
  const target = Number(process.env.CONV_GEN_TARGET ?? 1000);
  const seed = Number(process.env.CONV_SEED ?? 1337);

  const { products, source } = await loadProducts();
  console.log("[EFRO ConvGen] Loaded products", { count: products.length, source });

  if (products.length < 10) {
    throw new Error(`ConvGen needs >=10 products, got ${products.length}`);
  }

  // deterministisches Shuffle ist inside builder; hier optional nur loggen
  const convs = buildHardConversations(products, target, seed);

  const outFile = path.resolve(process.cwd(), "scripts/conversations/conv.generated1000.ts");
  writeTsFile(outFile, convs);

  console.log(`[EFRO ConvGen] WROTE: ${outFile} (LEN=${convs.length})`);
  console.log("[EFRO ConvGen] sample[0]=", convs[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});







