import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";
import { runSellerBrain } from "../src/lib/sales/sellerBrain";

async function main() {
  const loaded = await loadMeaningfulProducts();
  const products = loaded.products ?? [];
  console.log("[REPRO] products:", products.length, "source:", loaded.source, "fixture:", process.env.SCENARIO_PRODUCTS_FIXTURE);

  const turns = [
    { intent: "quick_buy", q: "Ich brauche The Coming Soon Snowboard." },
    { intent: "quick_buy", q: "Ich brauche Holzeisenbahn Starterset." },
    { intent: "quick_buy", q: "Ich brauche çığş öüı test." },
  ] as const;

  for (const t of turns) {
    const r:any = await runSellerBrain(t.q, t.intent as any, products as any, "pro", undefined, undefined);
    const rec = (r?.recommended ?? r?.recommendedProducts ?? r?.products ?? []);
    console.log("\n---");
    console.log("Q:", t.q);
    console.log("count:", rec?.length ?? 0);
    console.log("firstTitles:", (rec ?? []).slice(0,4).map((p:any)=>p?.title));
    console.log("debug:", r?.debugFlags ?? r?.debug ?? null);
    console.log("category:", r?.category ?? r?.effectiveCategorySlug ?? null);
  }
}

main().catch((e) => {
  console.error("REPRO ERROR", e);
  process.exit(1);
});
