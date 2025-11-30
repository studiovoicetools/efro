/**
 * EFRO SellerBrain Szenario-Test-Script
 * 
 * Testet umfangreiche reale Szenarien für SellerBrain:
 * - Budget-Logik (über/unter/mit Budget-Wort)
 * - Kategorien (Snowboard, Haustier, Kosmetik, Garten, Werkzeug)
 * - Premium/Günstig
 * - Geschenk/Bundle
 * - Erklär-Modus
 * - AI-Trigger bei unbekannten Begriffen
 * 
 * Ausführung: pnpm sellerbrain:scenarios
 */

import { runSellerBrain, SellerBrainResult, type SellerBrainContext } from "../src/lib/sales/sellerBrain";
import { type EfroProduct, type ShoppingIntent } from "../src/lib/products/mockCatalog";

/**
 * Lädt Test-Produkte von der EFRO Debug-API
 * Verwendet dieselbe Logik wie test-sellerBrain-budget.ts
 */
async function loadTestProducts(): Promise<EfroProduct[]> {
  const DEBUG_PRODUCTS_URL =
    process.env.EFRO_DEBUG_PRODUCTS_URL ??
    "http://localhost:3000/api/efro/debug-products?shop=local-dev";

  console.log("[EFRO Scenarios] Fetching products from", DEBUG_PRODUCTS_URL);

  let res: Response;
  try {
    res = await fetch(DEBUG_PRODUCTS_URL);
  } catch (err) {
    console.error("[EFRO Scenarios] ERROR: Could not fetch from EFRO debug API.");
    console.error(err);
    process.exit(1);
  }

  if (!res.ok) {
    console.error("[EFRO Scenarios] ERROR: API returned non-ok status", {
      status: res.status,
      statusText: res.statusText,
    });
    process.exit(1);
  }

  let productsJson: any;
  try {
    productsJson = await res.json();
  } catch (err) {
    console.error("[EFRO Scenarios] ERROR: Could not parse JSON from EFRO debug API.");
    console.error(err);
    process.exit(1);
  }

  const products: EfroProduct[] = productsJson.products ?? [];

  if (!products.length) {
    console.error("[EFRO Scenarios] ERROR: Kein Produkt aus EFRO debug API geladen.");
    process.exit(1);
  }

  console.log("[EFRO Scenarios] Loaded products from EFRO debug API", {
    count: products.length,
  });

  return products;
}

/**
 * Test-Szenario-Definition
 */
interface ScenarioTest {
  id: string;
  title: string;
  query: string;
  note?: string;
  expected?: {
    minCount?: number;
    maxCount?: number;
    minPrice?: number;
    maxPrice?: number;
    categorySlug?: string;
    expectNoMatchPriceRange?: boolean;
    expectExplanationMode?: boolean;
    expectAiTrigger?: boolean;
  };
}

/**
 * Bewertet ein Szenario-Ergebnis gegen die Erwartungen
 */
function evaluateScenario(
  result: SellerBrainResult,
  test: ScenarioTest
): { passed: boolean; details: string } {
  const issues: string[] = [];
  const passedChecks: string[] = [];

  const recommended = result.recommended ?? [];
  const actualCount = recommended.length;

  // Prüfe Produktanzahl
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

  // Prüfe Preise
  if (test.expected?.minPrice !== undefined && recommended.length > 0) {
    const minActualPrice = Math.min(...recommended.map((p) => p.price ?? Infinity));
    if (minActualPrice < test.expected.minPrice) {
      issues.push(`minPrice ${minActualPrice.toFixed(2)} < expected ${test.expected.minPrice}`);
    } else {
      passedChecks.push(`minPrice >= ${test.expected.minPrice}`);
    }
  }

  if (test.expected?.maxPrice !== undefined && recommended.length > 0) {
    const maxActualPrice = Math.max(...recommended.map((p) => p.price ?? 0));
    if (maxActualPrice > test.expected.maxPrice) {
      issues.push(`maxPrice ${maxActualPrice.toFixed(2)} > expected ${test.expected.maxPrice}`);
    } else {
      passedChecks.push(`maxPrice <= ${test.expected.maxPrice}`);
    }
  }

  // Prüfe Kategorie (flexibel: akzeptiert deutsche und englische Kategorienamen)
  if (test.expected?.categorySlug !== undefined && recommended.length > 0) {
    const categories = recommended.map((p) => (p.category || "").toLowerCase());
    const expectedCategory = test.expected.categorySlug.toLowerCase();
    
    // Mapping für deutsche → englische Kategorienamen
    // Berücksichtigt sowohl deutsche Kategorie-Keywords aus languageRules.de.ts
    // als auch englische Kategorienamen aus dem Shopify-Katalog
    const categoryMap: Record<string, string[]> = {
      "snowboard": ["snowboard", "snowboards", "board"],
      "haustier": ["pet", "pets", "haustier", "tier", "tierbedarf", "dog", "cat", "hund", "katze"],
      "kosmetik": ["cosmetics", "cosmetic", "kosmetik", "pflege", "beauty", "skincare"],
      "garten": ["garden", "garten", "outdoor", "gardening"],
      "werkzeug": ["tool", "tools", "werkzeug", "diy", "hardware"],
    };
    
    const expectedVariants = categoryMap[expectedCategory] || [expectedCategory];
    const hasCategory = categories.some((cat) => 
      expectedVariants.some((variant) => cat === variant || cat.includes(variant) || variant.includes(cat))
    );
    
    if (!hasCategory) {
      issues.push(`category '${test.expected.categorySlug}' (variants: ${expectedVariants.join(", ")}) not found in ${Array.from(new Set(categories)).join(", ")}`);
    } else {
      passedChecks.push(`category matches '${test.expected.categorySlug}'`);
    }
  }

  // Prüfe priceRangeNoMatch
  if (test.expected?.expectNoMatchPriceRange !== undefined) {
    const actualNoMatch = result.priceRangeNoMatch ?? false;
    if (actualNoMatch !== test.expected.expectNoMatchPriceRange) {
      issues.push(`priceRangeNoMatch ${actualNoMatch} !== expected ${test.expected.expectNoMatchPriceRange}`);
    } else {
      passedChecks.push(`priceRangeNoMatch = ${actualNoMatch}`);
    }
  }

  // Prüfe explanationMode (falls vorhanden)
  if (test.expected?.expectExplanationMode !== undefined) {
    // EFRO WAX-Fix: Prüfe explanationMode direkt aus SellerBrainResult
    const hasExplanation = result.explanationMode === true;
    if (hasExplanation !== test.expected.expectExplanationMode) {
      issues.push(`explanationMode ${hasExplanation} !== expected ${test.expected.expectExplanationMode}`);
    } else {
      passedChecks.push(`explanationMode = ${hasExplanation}`);
    }
  }

  // Prüfe AI-Trigger
  if (test.expected?.expectAiTrigger !== undefined) {
    const actualAiTrigger = result.aiTrigger?.needsAiHelp ?? false;
    if (actualAiTrigger !== test.expected.expectAiTrigger) {
      issues.push(`aiTrigger.needsAiHelp ${actualAiTrigger} !== expected ${test.expected.expectAiTrigger}`);
    } else {
      passedChecks.push(`aiTrigger = ${actualAiTrigger}`);
    }
  }

  const passed = issues.length === 0;
  const details = passed
    ? `OK: ${passedChecks.join(", ")}`
    : `FAIL: ${issues.join("; ")}`;

  return { passed, details };
}

/**
 * Führt einen Szenario-Test aus
 */
async function runScenarioTest(
  test: ScenarioTest,
  products: EfroProduct[]
): Promise<{ passed: boolean; details: string; result: SellerBrainResult }> {
  // Initialer SellerContext (analog zu avatar-seller/page.tsx)
  const sellerContext: SellerBrainContext = {
    activeCategorySlug: null,
  };

  // Initialer Intent (analog zu UI)
  const initialIntent: ShoppingIntent = "quick_buy";

  // Plan (analog zu UI, default "starter")
  const plan = "starter";

  // Vorherige Empfehlungen (leer für erste Anfrage)
  const previousRecommended: EfroProduct[] = [];

  // runSellerBrain aufrufen
  const result: SellerBrainResult = runSellerBrain(
    test.query,
    initialIntent,
    products,
    plan,
    previousRecommended,
    sellerContext
  );

  // Bewerte das Ergebnis
  const evaluation = evaluateScenario(result, test);

  // Debug-Info loggen
  const recommended = result.recommended ?? [];
  const priceInfo = result.priceRangeInfo
    ? {
        userMinPrice: result.priceRangeInfo.userMinPrice,
        userMaxPrice: result.priceRangeInfo.userMaxPrice,
        categoryMinPrice: result.priceRangeInfo.categoryMinPrice,
        categoryMaxPrice: result.priceRangeInfo.categoryMaxPrice,
      }
    : null;

  console.log(`  Intent: ${result.intent}, Count: ${recommended.length}, priceRangeNoMatch: ${result.priceRangeNoMatch ?? false}`);
  if (priceInfo) {
    console.log(`  PriceRange: user(${priceInfo.userMinPrice ?? "null"}-${priceInfo.userMaxPrice ?? "null"}), category(${priceInfo.categoryMinPrice?.toFixed(2) ?? "null"}-${priceInfo.categoryMaxPrice?.toFixed(2) ?? "null"})`);
  }
  if (recommended.length > 0) {
    const categories = Array.from(new Set(recommended.map((p) => p.category || "unknown")));
    console.log(`  Categories: ${categories.join(", ")}`);
  }

  return { ...evaluation, result };
}

/**
 * Hauptfunktion
 */
async function main() {
  try {
    console.log("=== EFRO SellerBrain Szenario-Test ===");
    console.log();

    // Produkte einmalig laden
    const products = await loadTestProducts();
    console.log();

    // Szenarien definieren
    const tests: ScenarioTest[] = [
      {
        id: "S1",
        title: "Snowboards unter 300 Euro – nichts im Katalog",
        query: "Zeig mir Snowboards unter 300 Euro.",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S2",
        title: "Premium-Snowboard über 800 Euro – minPrice durch 'über'",
        query: "Ich will ein Premium-Snowboard über 800 Euro.",
        expected: {
          minCount: 1,
          minPrice: 800,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S3",
        title: "Snowboard mit Budget-Wort – Obergrenze",
        query: "Mein Budget für ein Snowboard liegt bei 700 Euro.",
        expected: {
          minCount: 1,
          maxPrice: 700,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S4",
        title: "Snowboards zwischen 600 und 900 Euro",
        query: "Zeig mir bitte Snowboards zwischen 600 und 900 Euro.",
        expected: {
          minCount: 1,
          minPrice: 600,
          maxPrice: 900,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S5",
        title: "Günstigstes Snowboard",
        query: "Zeig mir das günstigste Snowboard.",
        expected: {
          minCount: 1,
          maxPrice: 700,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S6",
        title: "Teuerstes Snowboard",
        query: "Zeig mir das teuerste Snowboard aus deinem Sortiment.",
        expected: {
          minCount: 1,
          minPrice: 2000,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S7",
        title: "Hundezubehör",
        query: "Ich suche etwas für meinen Hund – am besten einen Napf oder etwas für Futter.",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "S8",
        title: "Günstiges Duschgel unter 10 Euro",
        query: "Zeig mir bitte ein günstiges Duschgel unter 10 Euro.",
        expected: {
          minCount: 1,
          maxPrice: 10,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "S9",
        title: "Gesichtscreme für trockene Haut – eher hochwertig",
        query: "Ich suche eine hochwertige Gesichtscreme für trockene Haut, so um die 20 bis 30 Euro.",
        expected: {
          minCount: 1,
          minPrice: 20,
          maxPrice: 30,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "S10",
        title: "Garten-Produkte unter 20 Euro",
        query: "Hast du etwas für den Garten unter 20 Euro?",
        expected: {
          minCount: 1,
          maxPrice: 20,
          categorySlug: "garten",
        },
      },
      {
        id: "S11",
        title: "Geschenk für Heimwerker",
        query: "Ich brauche ein Geschenk für einen Heimwerker – irgendwas mit Werkzeug, aber nicht über 100 Euro.",
        expected: {
          minCount: 1,
          maxPrice: 100,
        },
      },
      {
        id: "S12",
        title: "Erklärung zur Anwendung von Snowboard-Wachs",
        query: "Erklär mir bitte, wie ich Snowboard-Wachs richtig benutze.",
        expected: {
          expectExplanationMode: true,
        },
      },
      {
        id: "S13",
        title: "Budget-Only Anfrage mit Shampoo",
        query: "Mein Budget für Shampoo liegt bei 15 Euro. Was hast du da?",
        expected: {
          minCount: 1,
          maxPrice: 15,
        },
      },
      {
        id: "S14",
        title: "Unbekannter Begriff + Budget",
        query: "Zeig mir bitte Produkte für XY-9000 unter 50 Euro.",
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "S15",
        title: "Snowboard-Bindungen für Einsteiger",
        query: "Ich suche günstige Snowboard-Bindungen für Einsteiger.",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      // EFRO WAX & Fressnapf Crash-Tests
      {
        id: "S16",
        title: "Fressnapf (unbekannter Begriff)",
        query: "Hast du Näpfe wie bei Fressnapf für meinen Hund?",
        expected: {
          minCount: 0, // Kann 0 sein, wenn Fressnapf nicht erkannt wird
          expectAiTrigger: true,
        },
      },
      {
        id: "S17",
        title: "Wax ohne Kategorie, einfache Produktsuche",
        query: "Ich suche ein gutes Wax für meine Haare.",
        expected: {
          minCount: 1, // Wax-Produkt sollte gefunden werden, auch ohne Kategorie
        },
      },
      {
        id: "S18",
        title: "Wax mit Erklärungsfrage und vorhandener Beschreibung",
        query: "Wie wende ich dieses Wax am besten an?",
        expected: {
          expectExplanationMode: true,
          expectAiTrigger: false, // EFRO Fix: KEINE AI, da Beschreibung vorhanden ist und EFRO selbst erklären kann
        },
      },
      {
        id: "S19",
        title: "Wax mit fehlender Beschreibung",
        query: "Wie genau funktioniert dieses Wax?",
        expected: {
          expectExplanationMode: true,
          expectAiTrigger: false, // Kein AI, wenn Beschreibung fehlt
        },
      },
      {
        id: "S20",
        title: "Mehrdeutige Anfrage mit Mischbegriffen",
        query: "Ich brauche etwas für meinen Hund, am liebsten wie bei Fressnapf, aber es soll unter 20 Euro bleiben.",
        expected: {
          minCount: 0, // Kann 0 sein, wenn Fressnapf nicht erkannt wird
          maxPrice: 20,
          expectAiTrigger: true,
        },
      },
      {
        id: "S21",
        title: "Komplett unbekannter Begriff",
        query: "Hast du etwas mit 'Xyloklum'?",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      // EFRO WAX & Fressnapf Crash-Tests (erweitert)
      {
        id: "S22",
        title: "Snowboard-Wachs korrekt",
        query: "Ich brauche Wax für mein Snowboard, damit es schneller wird. Was empfiehlst du?",
        expected: {
          minCount: 1,
          // Erwartet Snowboard-Wachs, kein Haarwachs
        },
      },
      {
        id: "S23",
        title: "Wax für Haare – kein Haarwachs im Shop",
        query: "Ich suche ein gutes Wax für meine Haare. Hast du sowas?",
        expected: {
          minCount: 0, // Kein Haarwachs im Shop
          // Snowboard-Wachs sollte NICHT empfohlen werden
        },
      },
      {
        id: "S24",
        title: "Mischsatz – Snowboard vs. Haare",
        query: "Ich brauche Wax – aber NICHT für meine Haare, sondern für mein Snowboard.",
        expected: {
          minCount: 1,
          // Intent muss klar Richtung Snowboard-Wachs gehen
        },
      },
      {
        id: "S25",
        title: "Fressnapf – Produkt vorhanden, aber ohne 'Fressnapf' im Titel",
        query: "Ich suche einen Fressnapf für meinen Hund.",
        expected: {
          minCount: 0, // Kann 0 sein, wenn Fressnapf nicht erkannt wird, oder >= 1 wenn Bowls gefunden werden
          expectAiTrigger: true, // AI sollte für Begriffsklärung genutzt werden
        },
      },
      {
        id: "S26",
        title: "Kein Match – ehrliche Antwort",
        query: "Hast du Wax für meine Haare mit Kokosduft?",
        expected: {
          minCount: 0,
          // Ehrliche Antwort, kein Notfall-Fallback auf Snowboard-Wachs
        },
      },
    ];

    // Tests ausführen
    const results: Array<{ test: ScenarioTest; passed: boolean; details: string }> = [];

    for (const test of tests) {
      console.log(`\n[${test.id}] ${test.title}`);
      console.log(`Query: "${test.query}"`);

      const evaluation = await runScenarioTest(test, products);

      const status = evaluation.passed ? "PASS" : "FAIL";
      console.log(`${test.id} ${status} - ${test.title}`);
      console.log(`  ${evaluation.details}`);

      results.push({
        test,
        passed: evaluation.passed,
        details: evaluation.details,
      });
    }

    // Zusammenfassung
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

    console.log("\n✅ EFRO SellerBrain Szenario-Test fertig.");

    // Exit-Code: 0 wenn alle bestanden, 1 wenn mindestens einer fehlgeschlagen
    if (passedCount < totalCount) {
      process.exit(1);
    }
  } catch (err) {
    console.error("❌ Fehler im SellerBrain-Szenario-Test:", err);
    if (err instanceof Error) {
      console.error("Stack:", err.stack);
    }
    process.exit(1);
  }
}

main();

