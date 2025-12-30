import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";
import { runSellerBrain } from "../src/lib/sales/sellerBrain";

function unwrap(r: any) {
  let cur = r;
  for (let i = 0; i < 10; i++) {
    if (cur && typeof cur === "object" && "result" in cur && cur.result) cur = cur.result;
    else break;
  }
  return cur;
}

function pickRecs(obj: any) {
  const r =
    obj?.recommendations ??
    obj?.recommended ??
    obj?.recommendedProducts ??
    obj?.products ??
    obj?.items ??
    obj?.result?.recommendations ??
    obj?.result?.recommended ??
    [];
  if (Array.isArray(r)) return r;
  // manchmal ist recommendations ein Objekt mit .items/.products
  if (r && typeof r === "object") {
    if (Array.isArray((r as any).items)) return (r as any).items;
    if (Array.isArray((r as any).products)) return (r as any).products;
  }
  return [];
}

function recTitle(x: any) {
  return x?.title ?? x?.product?.title ?? x?.item?.title ?? x?.product?.name ?? x?.name ?? null;
}

async function main() {
  const loaded = await loadMeaningfulProducts();
  const products = loaded.products ?? [];

  const qs = [
    "Ich brauche The Coming Soon Snowboard.",
    "Ich brauche Holzeisenbahn Starterset.",
  ];

  for (const q of qs) {
    const r: any = await runSellerBrain(q, "explore" as any, products as any, "pro", undefined, undefined);

    const u0 = r;
    const u1 = unwrap(r);

    const rec0 = pickRecs(u0);
    const rec1 = pickRecs(u1);

    console.log("\n==============================");
    console.log("Q:", q);
    console.log("TOP keys:", Object.keys(u0 ?? {}));
    console.log("TOP recCount:", Array.isArray(rec0) ? rec0.length : "not-array");
    console.log("TOP firstTitles:", (Array.isArray(rec0) ? rec0 : []).slice(0, 4).map((p: any) => recTitle(p)));

    if (u1 !== u0) {
      console.log("UNWRAPPED keys:", Object.keys(u1 ?? {}));
      console.log("UNWRAPPED recCount:", Array.isArray(rec1) ? rec1.length : "not-array");
      console.log("UNWRAPPED firstTitles:", (Array.isArray(rec1) ? rec1 : []).slice(0, 4).map((p: any) => recTitle(p)));
    } else {
      console.log("UNWRAP: no wrapping detected");
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
