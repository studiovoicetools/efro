// @ts-nocheck
// scripts/snapshot-supabase-products50.ts
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getEfroDemoShop, getProductsForShop } from "../src/lib/efro/efroSupabaseRepository";

async function main() {
  const take = Number(process.env.EFRO_PRODUCTS_TAKE ?? "50");
  const timeoutMs = Number(process.env.EFRO_PRODUCTS_TIMEOUT_MS ?? "12000");

  const shop = await getEfroDemoShop();
  if (!shop) throw new Error("NO_DEMO_SHOP (getEfroDemoShop returned null)");

  const shopUuid: string =
    // @ts-ignore
    shop.shop_uuid ?? shop.uuid ?? shop.id;

  if (!shopUuid) throw new Error("NO_SHOP_UUID from getEfroDemoShop() result");

  const res: any = await getProductsForShop(({
    shopUuid,
    take,
    timeoutMs,
  }) as any);

  const products = res?.products ?? [];
  if (!Array.isArray(products)) throw new Error("products is not an array");
  if (products.length === 0) throw new Error("0 products loaded from Supabase");

  const outDir = path.resolve("scripts", "fixtures");
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, "supabase.products50.json");
  fs.writeFileSync(outPath, JSON.stringify(products, null, 2), "utf8");

  console.log("WROTE:", outPath, "LEN=", products.length);
  console.log("FIRST_TITLE:", products[0]?.title ?? products[0]?.name ?? "(no title)");
}

main().catch((e) => {
  console.error("SNAPSHOT_FAIL:", e?.message ?? e);
  process.exit(1);
});
