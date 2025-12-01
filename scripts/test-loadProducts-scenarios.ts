import { loadProductsForShop, type LoadProductsResult } from "../src/lib/products/efroProductLoader.ts";

const realShop = process.env.SHOPIFY_STORE_DOMAIN || "MISSING_SHOPIFY_STORE_DOMAIN";

const scenarios: { name: string; shopDomain: string | null }[] = [
  { name: "no-shop (null)", shopDomain: null },
  { name: "demo", shopDomain: "demo" },
  { name: "local-dev", shopDomain: "local-dev" },
  {
    name: "real-shop (SHOPIFY_STORE_DOMAIN)",
    shopDomain: realShop === "MISSING_SHOPIFY_STORE_DOMAIN" ? null : realShop,
  },
];

async function runScenario(shop: { name: string; shopDomain: string | null }) {
  const startedAt = new Date();
  
  console.log("====================================================");
  console.log("[EFRO TEST loadProducts] Scenario:", shop.name);
  console.log("[EFRO TEST loadProducts] shopDomain:", shop.shopDomain);
  console.log("[EFRO TEST loadProducts] startedAt:", startedAt.toISOString());

  try {
    const result: LoadProductsResult = await loadProductsForShop(shop.shopDomain);
    const durationMs = Date.now() - startedAt.getTime();

    console.log("[EFRO TEST loadProducts] success =", result.success);
    console.log("[EFRO TEST loadProducts] source =", result.source);
    console.log("[EFRO TEST loadProducts] products.length =", result.products?.length ?? 0);
    
    if (result.error) {
      console.log("[EFRO TEST loadProducts] error =", result.error);
    }
    
    console.log("[EFRO TEST loadProducts] durationMs:", durationMs);
    console.log("====================================================");
  } catch (error) {
    const durationMs = Date.now() - startedAt.getTime();
    console.log("[EFRO TEST loadProducts] success = false");
    console.log("[EFRO TEST loadProducts] durationMs:", durationMs);
    console.error("[EFRO TEST loadProducts] error:", error);
    console.log("====================================================");
  }
}

async function main() {
  console.log("====================================================");
  console.log("[EFRO TEST loadProducts] START");
  console.log("[EFRO TEST loadProducts] scenarios:", scenarios.map(s => s.name).join(", "));
  console.log("====================================================");

  for (const shop of scenarios) {
    // Sequential, damit das Log lesbar bleibt
    // eslint-disable-next-line no-await-in-loop
    await runScenario(shop);
  }

  console.log("====================================================");
  console.log("[EFRO TEST loadProducts] END");
  console.log("====================================================");
}

main().catch((e) => {
  console.error("[EFRO TEST loadProducts] FATAL:", e);
  process.exit(1);
});

