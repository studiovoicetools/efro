/* eslint-disable no-console */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocalIfMissing } from "./_loadEnvLocal";

type AnyObj = Record<string, any>;

async function main() {
  loadEnvLocalIfMissing([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("[snapshot] missing SUPABASE_URL / SERVICE KEY");
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Wichtig: gleiche Quelle wie dein Produktloader (bei dir ist es "products")
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("title", { ascending: true });

  if (error) {
    console.error("[snapshot] supabase error:", error);
    process.exit(3);
  }

  const products = (data ?? []) as AnyObj[];
  const outPath = process.env.SCENARIO_PRODUCTS_FIXTURE
    ? String(process.env.SCENARIO_PRODUCTS_FIXTURE)
    : "scripts/fixtures/products.demo.supabase.snapshot.json";

  const abs = path.resolve(process.cwd(), outPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });

  await fs.writeFile(abs, JSON.stringify({ products }, null, 2), "utf8");
  console.log("[snapshot] wrote:", outPath, "count:", products.length);
}

main().catch((e) => {
  console.error("[snapshot] fatal:", e);
  process.exit(1);
});
