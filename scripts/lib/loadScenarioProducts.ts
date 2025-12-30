import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

type AnyProduct = Record<string, any>;

function parseFixture(p: string): { products: AnyProduct[]; meta: any } {
  const raw = readFileSync(p, "utf-8");
  const json = JSON.parse(raw);
  if (Array.isArray(json)) return { products: json, meta: { ok: true, source: "fixture-array" } };
  if (json && Array.isArray(json.products)) return { products: json.products, meta: json };
  throw new Error(`Fixture has unexpected format: ${p}`);
}

function tagsToArray(row: AnyProduct): string[] {
  if (Array.isArray(row.tags_arr)) return row.tags_arr.filter(Boolean).map((s: any) => String(s));
  if (Array.isArray(row.tags_norm)) return row.tags_norm.filter(Boolean).map((s: any) => String(s));
  const t = row.tags;
  if (typeof t === "string") return t.split(/[,;]+/g).map((s) => s.trim()).filter(Boolean);
  return [];
}

export async function loadMeaningfulProducts(): Promise<{
  source: string;
  rawCount: number;
  products: AnyProduct[];
}> {
  const fixture = process.env.SCENARIO_PRODUCTS_FIXTURE;
  if (!fixture) {
    throw new Error(
      "SCENARIO_PRODUCTS_FIXTURE is not set. Example: export SCENARIO_PRODUCTS_FIXTURE='scripts/fixtures/products.demo.supabase.json'"
    );
  }

  const abs = path.isAbsolute(fixture) ? fixture : path.join(process.cwd(), fixture);
  if (!existsSync(abs)) throw new Error(`Fixture not found: ${abs}`);

  const { products, meta } = parseFixture(abs);

  // Normalize shape a bit, but DO NOT FILTER out BAD-* (hardcore wants truth)
  const normalized = products.map((p) => ({
    id: String(p.id ?? ""),
    sku: p.sku ?? null,
    title: p.title ?? null,
    description: p.description ?? null,
    price: p.price ?? null,
    compare_at_price: p.compare_at_price ?? null,
    tags: tagsToArray(p),
    category: p.category ?? null,
    imageUrl: p.image_url ?? p.featuredImage ?? null,
    productUrl: p.product_url ?? null,
    shop_domain: p.shop_domain ?? null,
    available: p.available ?? null,
    is_sellable: p.is_sellable ?? null,
    sellability_status: p.sellability_status ?? null,
    sellability_reason: p.sellability_reason ?? null,
    _raw: p,
  }));

  return {
    source: meta?.source ?? "fixture",
    rawCount: normalized.length,
    products: normalized,
  };
}
