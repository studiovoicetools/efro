import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";
import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { SellerBrainContext } from "../src/lib/sales/modules/types";

async function main() {
  const loaded = await loadMeaningfulProducts();
  console.log("[DEBUG] loaded", {
    rawCount: loaded.rawCount,
    count: loaded.products?.length ?? 0,
    source: loaded.source,
    fixture: process.env.SCENARIO_PRODUCTS_FIXTURE ?? null,
  });

  const ctx: SellerBrainContext = { activeCategorySlug: null } as any;
  const q = "Ich suche sensitive.";
  const res: any = await runSellerBrain(q, "quick_buy", loaded.products as any, "starter", [], ctx);

  console.log("[DEBUG] result keys:", Object.keys(res).sort());
  console.log("[DEBUG] lengths:", {
    recommendedProducts: Array.isArray(res.recommendedProducts) ? res.recommendedProducts.length : null,
    recommended: Array.isArray(res.recommended) ? res.recommended.length : null,
    products: Array.isArray(res.products) ? res.products.length : null,
    sales_products: Array.isArray(res?.sales?.products) ? res.sales.products.length : null,
    sales_recommended: Array.isArray(res?.sales?.recommendedProducts) ? res.sales.recommendedProducts.length : null,
  });

  const list =
    (res.recommendedProducts ?? res.recommended ?? res.products ?? res?.sales?.recommendedProducts ?? res?.sales?.products ?? []) as any[];
  console.log("[DEBUG] first titles:", list.slice(0, 6).map(p => p?.title ?? null));
}

main().catch((e) => {
  console.error("[DEBUG] FATAL", e?.message ?? String(e));
  process.exit(1);
});
