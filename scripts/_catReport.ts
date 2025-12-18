import fs from "node:fs";
import path from "node:path";
import { loadDebugProducts } from "./lib/loadDebugProducts";

const normalize = (s: any) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const root = process.cwd();

const corePath = path.join(root, "data", "scenarios", "curated", "curated-core-388.json");
const core = JSON.parse(fs.readFileSync(corePath, "utf8"));
const coreCats = [...new Set((core || [])
  .map((t: any) => t?.expected?.categorySlug)
  .filter(Boolean)
  .map((x: any) => normalize(x))
)].sort();

const url =
  process.env.EFRO_DEBUG_PRODUCTS_URL ??
  "http://localhost:3000/api/efro/debug-products?shop=local-dev";

loadDebugProducts({ url })
  .then((res: any) => {
    const prods = res.products || [];
    const map = new Map<string, any>();

    for (const p of prods) {
      const cat = normalize(p.category || "");
      if (!cat) continue;

      const o = map.get(cat) || { count: 0, min: Infinity, max: -Infinity, sample: [] as string[] };
      o.count++;

      const price = Number(p.price ?? NaN);
      if (!Number.isNaN(price)) {
        o.min = Math.min(o.min, price);
        o.max = Math.max(o.max, price);
      }

      if (o.sample.length < 3) o.sample.push(String(p.title) + " (" + String(p.price) + ")");
      map.set(cat, o);
    }

    const prodCats = [...map.keys()].sort();
    const missing = prodCats.filter((c) => !coreCats.includes(c));

    console.log("CORE_EXPECTED_CATEGORYSLUGS_COUNT=", coreCats.length);
    console.log(coreCats.join("\n"));

    console.log("\nPRODUCT_CATEGORIES_NORMALIZED_COUNT=", prodCats.length);
    for (const c of prodCats) {
      const o = map.get(c);
      console.log(
        c +
          "\tcount=" + o.count +
          "\tpriceMin=" + (o.min === Infinity ? "-" : o.min) +
          "\tpriceMax=" + (o.max === -Infinity ? "-" : o.max) +
          "\tsample=" + o.sample.join(" | ")
      );
    }

    console.log("\nMISSING_IN_CORE_EXPECTED=", missing.length);
    console.log(missing.join("\n"));
  })
  .catch((e: any) => {
    console.error("ERR", e?.message || e);
    process.exit(1);
  });
