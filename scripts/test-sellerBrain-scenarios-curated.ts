/**
 * EFRO SellerBrain Curated Szenario-Runner
 *
 * Lädt baseTests aus:
 *  - data/scenarios/curated/curated-core-388.json
 *  - data/scenarios/curated/curated-live-612.json
 *
 * Expandeert Varianten (variantQueries und variants[{query}]) zu eigenständigen Tests
 * (IDs mit Suffixen). KEIN Smoke-Fill / addSmokeTestsToReachTarget.
 *
 * Validierung:
 *  - Wenn EFRO_SCENARIO_TARGET > 0 => FAIL
 *  - Gesamtanzahl nach Expansion muss exakt 1000 sein => FAIL sonst
 *
 * Ausführung: pnpm sellerbrain:scenarios:curated
 */

import fs from "fs";
import path from "path";

import { loadMeaningfulProducts } from "./lib/loadScenarioProducts";

import {
  runSellerBrain,
  type SellerBrainResult,
  type SellerBrainContext,
} from "../src/lib/sales/sellerBrain";
import {
  type EfroProduct,
  type ShoppingIntent,
} from "../src/lib/products/mockCatalog";
import { type SalesAction } from "../src/lib/sales/salesTypes";
import { normalizeUserInput } from "../src/lib/sales/modules/utils";

/**
 * Test-Szenario-Definition (gleich wie im Original)
 */
interface ScenarioTest {
  id: string;
  title: string;
  query: string;
  note?: string;
  context?: SellerBrainContext; // Optional: Kontext für diesen Test
  // zusätzliche Varianten derselben Frage, die alle zum selben erwarteten Ergebnis führen sollen
  variantQueries?: string[];
  /**
   * Optionale Varianten dieses Szenarios (z. B. Tippfehler, Umgangssprache,
   * andere Formulierungen mit identischer Erwartung).
   */
  variants?: {
    /**
     * Die alternative Query für diese Variante (z. B. mit Tippfehlern).
     */
    query: string;
    /**
     * Optionale Notiz, warum diese Variante existiert
     * (z. B. "Tippfehler", "Umgangssprache", "Denglisch").
     */
    note?: string;
  }[];
  expected?: {
    minCount?: number;
    maxCount?: number;
    minPrice?: number;
    maxPrice?: number;
    categorySlug?: string;
    expectNoMatchPriceRange?: boolean;
    expectExplanationMode?: boolean;
    expectAiTrigger?: boolean;
    expectIntent?: ShoppingIntent; // Optional: erwarteter Intent
    expectedPrimaryAction?: SalesAction; // Optional: erwartete Sales-Action
    expectedNotesIncludes?: string[]; // Optional: erwartete Notes (müssen alle enthalten sein)
  };
}

/**
 * Lädt Test-Produkte (wie im Original)
 */
async function loadTestProducts(): Promise<EfroProduct[]> {
  const loaded = await loadMeaningfulProducts();
  console.log("[EFRO Scenarios - curated] Loaded products (fixture-first)", {
    count: loaded.rawCount,
    source: loaded.source,
    fixture: process.env.SCENARIO_PRODUCTS_FIXTURE,
  });

  if (!loaded.products || loaded.products.length === 0) {
    console.error("[EFRO Scenarios - curated] ERROR: No products loaded from fixture.");
    process.exit(1);
  }

  return loaded.products as any;
}


/**
 * Bewertet ein Szenario-Ergebnis gegen die Erwartungen
 * (Identisch zur Original-Implementierung)
 */
function evaluateScenario(
  result: SellerBrainResult,
  test: ScenarioTest
): { passed: boolean; details: string } {
  const issues: string[] = [];
  const passedChecks: string[] = [];

  const recommended = (result as any).recommendedProducts ?? (result as any).recommended ?? (result as any).products ?? [];
  const actualCount = recommended.length;

  if (test.expected?.minCount !== undefined) {
    if (actualCount < test.expected.minCount) {
      issues.push(`count ${actualCount} < minCount ${test.expected.minCount}`);
    } else {
      passedChecks.push(`count >= ${test.expected.minCount}`);
    }
  }

  if (test.expected?.maxCount !== undefined) {
    if (actualCount > test.expected.maxCount) {
      issues.push(`count ${actualCount} > maxCount ${test.expected.maxCount}`);
    } else {
      passedChecks.push(`count <= ${test.expected.maxCount}`);
    }
  }

  if (test.expected?.minPrice !== undefined && recommended.length > 0) {
    const minActualPrice = Math.min(...recommended.map((p: any) => p.price ?? Infinity));
    if (minActualPrice < test.expected.minPrice) {
      issues.push(`minPrice ${minActualPrice.toFixed(2)} < expected ${test.expected.minPrice}`);
    } else {
      passedChecks.push(`minPrice >= ${test.expected.minPrice}`);
    }
  }

  if (test.expected?.maxPrice !== undefined && recommended.length > 0) {
    const maxActualPrice = Math.max(...recommended.map((p: any) => p.price ?? 0));
    if (maxActualPrice > test.expected.maxPrice) {
      issues.push(`maxPrice ${maxActualPrice.toFixed(2)} > expected ${test.expected.maxPrice}`);
    } else {
      passedChecks.push(`maxPrice <= ${test.expected.maxPrice}`);
    }
  }

  if (test.expected?.categorySlug !== undefined && recommended.length > 0) {
    const categories = recommended.map((p: any) => (p.category || "").toLowerCase()).filter(Boolean);
    const expectedCategory = test.expected.categorySlug.toLowerCase();

    const categoryMap: Record<string, string[]> = {
      snowboard: ["snowboard", "snowboards", "board"],
      haustier: ["haustier", "tier", "tierbedarf", "pets", "pet", "dog", "cat", "hund", "katze", "animal", "bowl"],
      kosmetik: ["kosmetik", "cosmetics", "cosmetic", "pflege", "beauty", "skincare", "shampoo", "duschgel", "cream", "creme"],
      garten: ["garten", "garden", "outdoor", "gardening"],
      werkzeug: ["werkzeug", "tool", "tools", "diy", "hardware"],
      haushalt: ["haushalt", "household", "home", "kitchen", "küche", "haushaltsgeräte", "wasserkocher", "electric kettle", "kettle"],
      elektronik: ["elektronik", "electronics", "smartphone", "phone", "handy", "tv", "fernseher"],
      mode: ["mode", "fashion", "kleidung", "bekleidung", "clothes", "jeans", "hose", "t-shirt"],
      perfume: ["perfume", "parfum", "parfüm", "duft", "eau de parfum"],
    };

    const expectedVariants = categoryMap[expectedCategory] || [expectedCategory];

    const hasCategory = categories.some((cat: any) =>
      expectedVariants.some((variant) => cat === variant || cat.includes(variant) || variant.includes(cat))
    );

    if (!hasCategory) {
      issues.push(
        `category '${test.expected.categorySlug}' (variants: ${expectedVariants.join(", ")}) not found in ${Array.from(
          new Set(categories)
        ).join(", ")}`
      );
    } else {
      passedChecks.push(`category matches '${test.expected.categorySlug}'`);
    }
  }

  if (test.expected?.expectNoMatchPriceRange !== undefined) {
    const actualNoMatch = result.priceRangeNoMatch ?? false;
    if (actualNoMatch !== test.expected.expectNoMatchPriceRange) {
      issues.push(`priceRangeNoMatch ${actualNoMatch} !== expected ${test.expected.expectNoMatchPriceRange}`);
    } else {
      passedChecks.push(`priceRangeNoMatch = ${actualNoMatch}`);
    }
  }

  if (test.expected?.expectExplanationMode !== undefined) {
    const hasExplanation = result.explanationMode === true;
    if (hasExplanation !== test.expected.expectExplanationMode) {
      issues.push(`explanationMode ${hasExplanation} !== expected ${test.expected.expectExplanationMode}`);
    } else {
      passedChecks.push(`explanationMode = ${hasExplanation}`);
    }
  }

  if (test.expected?.expectAiTrigger !== undefined) {
    const actualAiTrigger = result.aiTrigger?.needsAiHelp ?? false;
    if (actualAiTrigger !== test.expected.expectAiTrigger) {
      issues.push(`aiTrigger.needsAiHelp ${actualAiTrigger} !== expected ${test.expected.expectAiTrigger}`);
    } else {
      passedChecks.push(`aiTrigger = ${actualAiTrigger}`);
    }
  }

  if (test.expected?.expectIntent !== undefined) {
    if (result.intent !== test.expected.expectIntent) {
      issues.push(`intent '${result.intent}' !== expected '${test.expected.expectIntent}'`);
    } else {
      passedChecks.push(`intent = '${result.intent}'`);
    }
  }

  if (test.expected?.expectedPrimaryAction !== undefined) {
    // @ts-ignore
    const got = result.sales?.primaryAction;
    if (got !== test.expected.expectedPrimaryAction) {
      issues.push(`expected primaryAction=${test.expected.expectedPrimaryAction}, got=${got ?? "undefined"}`);
    } else {
      passedChecks.push(`primaryAction = '${got}'`);
    }
  }

  if (test.expected?.expectedNotesIncludes && test.expected.expectedNotesIncludes.length > 0) {
    // @ts-ignore
    const notes = result.sales?.notes ?? [];
    for (const expectedNote of test.expected.expectedNotesIncludes) {
      if (!notes.includes(expectedNote)) {
        issues.push(`expected sales.notes to include "${expectedNote}" but got [${notes.join(", ")}]`);
      } else {
        passedChecks.push(`notes includes "${expectedNote}"`);
      }
    }
  }

  const passed = issues.length === 0;
  const details = passed ? `OK: ${passedChecks.join(", ")}` : `FAIL: ${issues.join("; ")}`;

  return { passed, details };
}

/**
 * Führt einen Szenario-Test aus
 * (Identisch zur Original-Implementierung)
 */
async function runScenarioTest(
  test: ScenarioTest,
  products: EfroProduct[],
  initialContext?: SellerBrainContext
): Promise<{ passed: boolean; details: string; result: SellerBrainResult }> {
  const sellerContext: SellerBrainContext =
    initialContext ?? test.context ?? { activeCategorySlug: null };

  const initialIntent: ShoppingIntent = "quick_buy";
  const plan = "starter";
  const previousRecommended: EfroProduct[] = [];

  const normalizedQuery = normalizeUserInput(test.query);

  const result: SellerBrainResult = await runSellerBrain(
    test.query,
    initialIntent,
    products,
    plan,
    previousRecommended,
    sellerContext
  );

  const evaluation = evaluateScenario(result, test);

  const recommended = (result as any).recommendedProducts ?? (result as any).recommended ?? (result as any).products ?? [];
  const priceInfo = result.priceRangeInfo
    ? {
        userMinPrice: result.priceRangeInfo.userMinPrice,
        userMaxPrice: result.priceRangeInfo.userMaxPrice,
        categoryMinPrice: result.priceRangeInfo.categoryMinPrice,
        categoryMaxPrice: result.priceRangeInfo.categoryMaxPrice,
      }
    : null;

  console.log(
    `  Intent: ${(result as any).intent ?? (result as any).nextIntent ?? "unknown"}, Count: ${recommended.length}, priceRangeNoMatch: ${Boolean((result as any).priceRangeNoMatch)}`
  );
  if (priceInfo) {
    console.log(
      `  PriceRange: user(${priceInfo.userMinPrice ?? "null"}-${priceInfo.userMaxPrice ?? "null"}), category(${priceInfo.categoryMinPrice?.toFixed(
        2
      ) ?? "null"}-${priceInfo.categoryMaxPrice?.toFixed(2) ?? "null"})`
    );
  }
  if (recommended.length > 0) {
    const categories = Array.from(new Set(recommended.map((p: any) => p.category || "unknown")));
    console.log(`  Categories: ${categories.join(", ")}`);
  }

  if (test.id === "D8") {
    if (!result.priceRangeNoMatch) {
      evaluation.details += `\n    → FAIL: priceRangeNoMatch should be true`;
      evaluation.passed = false;
    } else {
      evaluation.details += `\n    → OK: priceRangeNoMatch = true`;
    }

    if (result.priceRangeInfo) {
      const pr = result.priceRangeInfo;
      if (pr.userMaxPrice !== 30) {
        evaluation.details += `\n    → FAIL: priceRangeInfo.userMaxPrice should be 30, got ${pr.userMaxPrice}`;
        evaluation.passed = false;
      } else {
        evaluation.details += `\n    → OK: priceRangeInfo.userMaxPrice = 30`;
      }

      const normalizedCategory = (pr.category || "").toLowerCase();
      if (normalizedCategory !== "haushalt") {
        evaluation.details += `\n    → FAIL: priceRangeInfo.category should be 'haushalt', got '${pr.category}'`;
        evaluation.passed = false;
      } else {
        evaluation.details += `\n    → OK: priceRangeInfo.category = 'haushalt'`;
      }

      if (pr.categoryMinPrice !== null && pr.categoryMinPrice <= 30) {
        evaluation.details += `\n    → FAIL: priceRangeInfo.categoryMinPrice should be > 30, got ${pr.categoryMinPrice}`;
        evaluation.passed = false;
      } else if (pr.categoryMinPrice !== null) {
        evaluation.details += `\n    → OK: priceRangeInfo.categoryMinPrice = ${pr.categoryMinPrice.toFixed(2)} > 30`;
      }

      if (recommended.length > 1) {
        let isSorted = true;
        for (let i = 1; i < recommended.length; i++) {
          const prevPrice = recommended[i - 1].price ?? 0;
          const currPrice = recommended[i].price ?? 0;
          if (currPrice < prevPrice) {
            isSorted = false;
            break;
          }
        }
        if (!isSorted) {
          evaluation.details += `\n    → FAIL: Products should be sorted ascending by price`;
          evaluation.passed = false;
        } else {
          evaluation.details += `\n    → OK: Products sorted ascending by price`;
        }
      }
    } else {
      evaluation.details += `\n    → FAIL: priceRangeInfo should be set`;
      evaluation.passed = false;
    }

    if (result.intent !== "quick_buy") {
      evaluation.details += `\n    → FAIL: intent should be 'quick_buy', got '${result.intent}'`;
      evaluation.passed = false;
    } else {
      evaluation.details += `\n    → OK: intent = 'quick_buy'`;
    }
  }

  return { ...evaluation, result };
}

/**
 * Helpers: JSON loader & Varianten-Expansion für curated suite
 */
function readJsonArray(filePath: string): any[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${filePath}`);
  }
  return parsed;
}

function expandBaseTestsFromLoaded(baseRaw: ScenarioTest[]): ScenarioTest[] {
  const expanded: ScenarioTest[] = [];
  for (const base of baseRaw) {
    // push base scenario but remove variantQueries/variants to avoid duplicate runs
    const { variantQueries, variants, ...baseRest } = base as any;
    expanded.push(baseRest as ScenarioTest);

    // expand variantQueries -> id suffix v1, v2...
    if (Array.isArray(variantQueries) && variantQueries.length > 0) {
      let variantIndex = 1;
      for (const q of variantQueries) {
        expanded.push({
          ...baseRest,
          id: `${base.id}v${variantIndex}`,
          query: q,
          variantQueries: undefined,
          variants: undefined,
          note: base.note ? `${base.note} [Variant ${variantIndex}]` : `Variant ${variantIndex} of ${base.id}`,
        } as ScenarioTest);
        variantIndex++;
      }
    }

    // expand variants (objects with query) -> use id suffix #v1, #v2...
    if (Array.isArray(variants) && variants.length > 0) {
      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        expanded.push({
          ...baseRest,
          id: `${base.id}#v${i + 1}`,
          query: v.query,
          variantQueries: undefined,
          variants: undefined,
          note: v.note ?? base.note,
        } as ScenarioTest);
      }
    }
  }
  return expanded;
}

/**
 * Hauptfunktion: curated runner (wie Original, mit curated sourcing)
 */
async function main() {
  try {
    console.log("=== EFRO SellerBrain Curated Scenario Runner ===");
    console.log();

    // Fail early if EFRO_SCENARIO_TARGET is set (curated must not be auto-filled)
    const targetTotal = Number(process.env.EFRO_SCENARIO_TARGET ?? "0");
    if (targetTotal && targetTotal > 0) {
      console.error(
        `FAIL: EFRO_SCENARIO_TARGET is set (${process.env.EFRO_SCENARIO_TARGET}) — curated suite must not be run with a target to artificially fill scenarios.`
      );
      process.exit(1);
    }

    // Load curated source files
    const cwd = process.cwd();
    const curatedDir = path.join(cwd, "data", "scenarios", "curated");
    const corePath = path.join(curatedDir, "curated-core-388.json");
    const livePath = path.join(curatedDir, "curated-live-612.json");

    const coreRaw = readJsonArray(corePath) as ScenarioTest[];
    const liveRaw = readJsonArray(livePath) as ScenarioTest[];

    console.log("[curated] loaded files", {
      coreCount: coreRaw.length,
      liveCount: liveRaw.length,
      corePath,
      livePath,
    });

    // Merge baseTests (core + live)
    const baseTests: ScenarioTest[] = [...coreRaw, ...liveRaw];

    // Expand variants for both files (base + variantQueries + variants[].query)
    const expandedCore = expandBaseTestsFromLoaded(coreRaw);
    const expandedLive = expandBaseTestsFromLoaded(liveRaw);

    const expandedTests = [...expandedCore, ...expandedLive];
    const total = expandedTests.length;
    const expected = 1000;

    console.log("[curated] expanded counts", {
      coreExpanded: expandedCore.length,
      liveExpanded: expandedLive.length,
      total,
    });

    if (total !== expected) {
      console.error(
        `FAIL: Total scenarios after expansion mismatch. expected=${expected} actual=${total} (coreRaw=${coreRaw.length}, liveRaw=${liveRaw.length})`
      );
      process.exit(1);
    }

    // Load products and run tests (rest mirrors original runner)
    const products = await loadTestProducts();
    console.log();

    const results: Array<{ test: ScenarioTest; passed: boolean; details: string }> = [];

    for (const test of expandedTests) {
      console.log(`\n[${test.id}] ${test.title}`);
      console.log(`Query: "${test.query}"`);

      const evaluation = await runScenarioTest(test, products, test.context);

      const status = evaluation.passed ? "PASS" : "FAIL";
      console.log(`${test.id} ${status} - ${test.title}`);
      console.log(`  ${evaluation.details}`);

      results.push({
        test,
        passed: evaluation.passed,
        details: evaluation.details,
      });
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("ZUSAMMENFASSUNG");
    console.log("=".repeat(60));

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;

    console.log(`\nErgebnis: ${passedCount}/${totalCount} Tests bestanden\n`);

    results.forEach((r) => {
      const status = r.passed ? "✓" : "✗";
      console.log(`${status} ${r.test.id}: ${r.test.title}`);
      if (!r.passed) {
        console.log(`    → ${r.details}`);
      }
    });

    console.log("\n✅ EFRO SellerBrain Curated Scenario Runner fertig.");

    if (passedCount < totalCount) {
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Fehler im curated Runner:", err);
    if (err instanceof Error) {
      console.error("Stack:", err.stack);
    }
    process.exit(1);
  }
}

main();
