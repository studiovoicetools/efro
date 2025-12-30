import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";
import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { SellerBrainContext } from "../src/lib/sales/modules/types";

function unwrap(result: any): any {
  let r: any = result;
  for (let i = 0; i < 6; i++) {
    if (r && typeof r === "object" && "result" in r) {
      const next = (r as any).result;
      if (next && typeof next === "object") {
        r = next;
        continue;
      }
    }
    break;
  }
  return r;
}

function pickArray(x: any): any[] {
  const candidates = [
    x?.recommendedProducts,
    x?.recommended,
    x?.products,
    x?.sales?.recommendedProducts,
    x?.sales?.products,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

async function main() {
  const loaded = await loadMeaningfulProducts();
  console.log("[DEBUG] loaded", {
    count: loaded.products?.length ?? 0,
    source: loaded.source,
    fixture: process.env.SCENARIO_PRODUCTS_FIXTURE ?? null,
  });

  const ctx: SellerBrainContext = { activeCategorySlug: null } as any;
  const q = "Ich suche sensitive.";
  const outer: any = await runSellerBrain(q, "quick_buy", loaded.products as any, "starter", [], ctx);
  const inner: any = unwrap(outer);

  console.log("[DEBUG] outer keys:", Object.keys(outer ?? {}).sort());
  console.log("[DEBUG] inner keys:", Object.keys(inner ?? {}).sort());

  const aOuter = pickArray(outer);
  const aInner = pickArray(inner);
  const aSummary = pickArray(outer?.summary);

  console.log("[DEBUG] counts", {
    outer: aOuter.length,
    inner: aInner.length,
    summary: aSummary.length,
  });

  const final = aInner.length ? aInner : (aSummary.length ? aSummary : aOuter);
  console.log("[DEBUG] first titles:", final.slice(0, 5).map((p: any) => p?.title ?? p?.name ?? null));
}

main().catch((e) => {
  console.error("[DEBUG] FATAL", e?.message ?? String(e));
  process.exit(1);
});
