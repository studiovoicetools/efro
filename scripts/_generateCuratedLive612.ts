import fs from "node:fs";
import path from "node:path";
import { loadDebugProducts } from "./lib/loadDebugProducts";

type ScenarioTest = {
  id: string;
  title: string;
  query: string;
  note?: string;
  expected?: {
    minCount?: number;
    categorySlug?: string;
  };
};

const root = process.cwd();
const outPath = path.join(root, "data", "scenarios", "curated", "curated-live-612.json");

const url =
  process.env.EFRO_DEBUG_PRODUCTS_URL ??
  "http://localhost:3000/api/efro/debug-products?shop=local-dev";

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function pushScenario(list: ScenarioTest[], s: ScenarioTest) {
  list.push(s);
}

function productQueries(title: string): string[] {
  const t = String(title || "").trim();
  return [
    `Ich suche ${t}.`,
    `Zeig mir bitte ${t}.`,
    `Hast du ${t}?`,
    `Kannst du ${t} empfehlen?`,
    `Ich möchte ${t} kaufen.`,
    `Gibt es ${t} bei dir?`,
    `Ich interessiere mich für ${t}.`,
    `Zeig mir Details zu ${t}.`,
    `Ich brauche ${t}.`,
    `Suche: ${t}`,
    `Bitte ${t} anzeigen.`,
    `Hast du so etwas wie ${t}?`,
  ];
}

function categoryQueries(cat: string): string[] {
  return [
    `Zeig mir ${cat}.`,
    `Ich suche Produkte aus der Kategorie ${cat}.`,
    `Was hast du an ${cat}?`,
    `Empfiehl mir etwas aus ${cat}.`,
    `Ich möchte etwas aus ${cat} kaufen.`,
    `Zeig mir die besten ${cat}.`,
    `Welche ${cat} hast du?`,
    `Gib mir Vorschläge für ${cat}.`,
    `Ich brauche ${cat}.`,
  ];
}

loadDebugProducts(url)
  .then((res: any) => {
    const products: any[] = res?.products || [];
    if (!Array.isArray(products) || products.length === 0) {
      throw new Error("No products loaded (products array empty).");
    }

    const live: ScenarioTest[] = [];

    // 1) Produkt-getriebene Tests: 45 Produkte * 12 = 540
    let idx = 1;
    for (const p of products) {
      const title = String(p?.title || "").trim();
      if (!title) continue;

      const qs = productQueries(title);
      for (let i = 0; i < qs.length; i++) {
        pushScenario(live, {
          id: `L${idx.toString().padStart(4, "0")}`,
          title: `Live: ${title} (q${i + 1})`,
          query: qs[i],
          expected: { minCount: 1 },
        });
        idx++;
      }
    }

    // 2) Kategorie-getriebene Tests: 8 Kategorien * 9 = 72  => 540 + 72 = 612
    const canonicalCats = ["elektronik", "garten", "haushalt", "haustier", "kosmetik", "mode", "perfume", "snowboard"];
    for (const cat of canonicalCats) {
      const qs = categoryQueries(cat);
      for (let i = 0; i < qs.length; i++) {
        pushScenario(live, {
          id: `L${idx.toString().padStart(4, "0")}`,
          title: `Live: category ${cat} (q${i + 1})`,
          query: qs[i],
          expected: { minCount: 1, categorySlug: cat },
        });
        idx++;
      }
    }

    if (live.length !== 612) {
      throw new Error(`Generator mismatch: expected 612, got ${live.length}`);
    }

    ensureDir(outPath);
    fs.writeFileSync(outPath, JSON.stringify(live, null, 2), "utf8");
    console.log("WROTE", outPath, "count=", live.length);
  })
  .catch((e: any) => {
    console.error("ERR", e?.message || e);
    process.exit(1);
  });
