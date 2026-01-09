import { runSellerBrain } from "../src/lib/sales/sellerBrain";
import type { EfroProduct } from "../src/lib/products/mockCatalog";
import type { SellerBrainContext } from "../src/lib/sales/brain/types";
import fs from "node:fs";

const SNAP = "scripts/fixtures/products-120.newuuid-nonsmoke.snapshot.json";
const products = JSON.parse(fs.readFileSync(SNAP, "utf-8")) as EfroProduct[];

function pickReplyText(out: any): string {
  return String(out?.replyText ?? out?.reply ?? out?.text ?? "");
}
function pickRecommended(out: any): any[] {
  const r = out?.recommended ?? out?.products ?? out?.items ?? [];
  return Array.isArray(r) ? r : [];
}
function title(p: any) { return String(p?.title ?? p?.name ?? p?.id ?? ""); }

(async () => {
  const plan = "starter";
  let previousRecommended: any[] = [];
  let context: SellerBrainContext | undefined = { activeCategorySlug: null } as any;

  const t1 = await runSellerBrain(
    "zubehör für smartphone unter 150€",
    "explore" as any,
    products,
    plan,
    previousRecommended as any,
    context as any
  );
  previousRecommended = pickRecommended(t1);
  context = (t1?.nextContext ?? context) as any;

  const t2 = await runSellerBrain(
    "ich brauche snowboard günstig, max 75 euro",
    "explore" as any,
    products,
    plan,
    previousRecommended as any,
    context as any
  );

  const reply2 = pickReplyText(t2).toLowerCase();
  const rec2 = pickRecommended(t2);

  console.log("turn1_reco_titles:", previousRecommended.map(title));
  console.log("turn2_reply:", pickReplyText(t2).replace(/\s+/g," ").slice(0,240));
  console.log("turn2_reco_count:", rec2.length);
  console.log("turn2_reco_titles:", rec2.map(title));

  const saysNoSnowboard =
    reply2.includes("keine snowboard") || reply2.includes("keine snowboards") ||
    (reply2.includes("finde ich nur") && reply2.includes("keine snowboard"));

  if (saysNoSnowboard && rec2.length > 0) {
    console.error("FAIL: mismatch says 'no snowboard' but still recommends carry-over products");
    process.exit(1);
  }
  console.log("OK: no carry-over recommendations on mismatch");
  process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
