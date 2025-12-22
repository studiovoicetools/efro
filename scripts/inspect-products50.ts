// scripts/inspect-products50.ts
import fs from "node:fs";

const p = "scripts/fixtures/supabase.products50.json";
const raw = fs.readFileSync(p, "utf8");
const arr = JSON.parse(raw);

if (!Array.isArray(arr) || arr.length === 0) {
  console.log("INVALID_OR_EMPTY");
  process.exit(1);
}

const first = arr[0];
const keys = Object.keys(first).sort();

console.log("LEN=", arr.length);
console.log("FIRST_KEYS_COUNT=", keys.length);
console.log("FIRST_KEYS=", keys.join(", "));

// Quick sanity: show a compact preview of a few important fields if present
const pick = (o: any) => ({
  id: o.id ?? o.product_id ?? o.shopify_product_id ?? o.uuid ?? o.sku ?? null,
  title: o.title ?? o.name ?? null,
  price: o.price ?? o.price_eur ?? o.min_price ?? null,
  category: o.category ?? o.category_slug ?? o.categorySlug ?? null,
  tags: o.tags ?? null,
  image_url: o.image_url ?? o.image ?? o.imageUrl ?? null,
});

console.log("FIRST_PICK=", JSON.stringify(pick(first), null, 2));
