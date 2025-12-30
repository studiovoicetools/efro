import path from "node:path";
import { existsSync, writeFileSync } from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

(function loadEnv() {
  const cwd = process.cwd();
  for (const f of [".env.local", ".env"]) {
    const p = path.join(cwd, f);
    if (existsSync(p)) dotenv.config({ path: p });
  }
})();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("❌ Snapshot failed: Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const OUT =
  process.env.SCENARIO_PRODUCTS_FIXTURE_OUT ??
  "scripts/fixtures/products.demo.supabase.json";

const MIN = Number(process.env.SCENARIO_MIN_PRODUCTS ?? "30");

// Optional: wenn du WIRKLICH filtern willst, setz SCENARIO_SHOP_DOMAIN.
// Default: wir ziehen ALLE 120 aus public.products (weil du nur 1 echte Quelle willst).
const SHOP_DOMAIN = process.env.SCENARIO_SHOP_DOMAIN ?? null;

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("=== SNAPSHOT Supabase products ===");
  console.log("table = public.products");
  console.log("shop_domain filter =", SHOP_DOMAIN ?? "(none)");
  console.log("out =", OUT);

  let q = supabase
    .from("products")
    .select(
      [
        "id",
        "sku",
        "title",
        "description",
        "price",
        "compare_at_price",
        "tags",
        "tags_arr",
        "tags_norm",
        "category",
        "image_url",
        "product_url",
        "shop_domain",
        "available",
        "is_sellable",
        "sellability_status",
        "sellability_reason",
      ].join(",")
    );

  if (SHOP_DOMAIN) q = q.eq("shop_domain", SHOP_DOMAIN);

  const r = await q.limit(5000);
  if (r.error) throw r.error;

  const rows = r.data ?? [];
  const rawCount = rows.length;

  if (rawCount < MIN) {
    throw new Error(
      `FAIL: raw products (${rawCount}) < min (${MIN}) for shop_domain=${SHOP_DOMAIN ?? "(none)"}.`
    );
  }

  // Keine harte Sanitization hier – wir wollen BAD-* drin lassen,
  // damit EFRO “wahrheitsgemäß” reagieren kann, wenn jemand danach fragt.
  const payload = {
    ok: true,
    source: "supabase:public.products",
    shop_domain: SHOP_DOMAIN,
    generatedAt: new Date().toISOString(),
    rawCount,
    products: rows,
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf-8");
  console.log("✅ Snapshot OK:", { rawCount, out: OUT });
}

main().catch((err) => {
  console.error("❌ Snapshot failed:", err);
  process.exit(1);
});
