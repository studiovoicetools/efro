import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";
import { runSellerBrain } from "../src/lib/sales/sellerBrain";

async function main() {
  const loaded = await loadMeaningfulProducts();
  const products = loaded.products ?? [];

  const q = "Ich brauche çığş öüı test.";
  const r: any = await runSellerBrain(q, "quick_buy" as any, products as any, "pro", undefined, undefined);
  const rec = (r?.recommended ?? r?.recommendedProducts ?? r?.products ?? []);
  console.log("Q:", q);
  console.log("count:", rec?.length ?? 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
