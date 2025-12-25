import { extractUserPriceRange } from "../../src/lib/sales/budget";

const tests = [
  'Do you have something like "inventory"? Budget about 700 €.',
  'Do you have something like "inventory"? Budget 700.',
  'Ich suche etwas wie "inventory". Budget ca. 700 €.',
];

for (const t of tests) {
  const r = extractUserPriceRange(t);
  console.log("\nTEXT:", t);
  console.log({
    minPrice: r.minPrice,
    maxPrice: r.maxPrice,
    hasBudgetWord: r.hasBudgetWord,
    isBudgetAmbiguous: r.isBudgetAmbiguous,
    wantsCheapest: r.wantsCheapest,
    notes: r.notes?.slice(0, 6),
  });
}
