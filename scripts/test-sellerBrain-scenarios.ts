/**
 * EFRO SellerBrain Szenario-Test-Script (SUPER CRASH TEST)
 *
 * Testet umfangreiche reale Szenarien für SellerBrain:
 * - Budget-Logik (über/unter/Range/Budget-Wort)
 * - Kategorien (Snowboard, Haustier, Kosmetik, Garten, Werkzeug, Haushalt, Elektronik, Mode, Parfüm)
 * - Premium / günstig / teuerstes / günstigstes
 * - Geschenk / Cross-Sell / Kontext-Ketten
 * - Erklär-Modus (explanationMode)
 * - AI-Trigger bei unbekannten Begriffen / Marken / Fantasie-Wörtern
 * - Queries für Produkte, die NICHT im Katalog vorhanden sind
 *
 * Ausführung: pnpm sellerbrain:scenarios
 */

import {
  runSellerBrain,
  type SellerBrainResult,
  type SellerBrainContext,
} from "../src/lib/sales/sellerBrain";
import {
  type EfroProduct,
  type ShoppingIntent,
} from "../src/lib/products/mockCatalog";

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
    console.error(
      "[EFRO Scenarios] ERROR: Could not fetch from EFRO debug API."
    );
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
    console.error(
      "[EFRO Scenarios] ERROR: Could not parse JSON from EFRO debug API."
    );
    console.error(err);
    process.exit(1);
  }

  const products: EfroProduct[] = productsJson.products ?? [];

  if (!products.length) {
    console.error(
      "[EFRO Scenarios] ERROR: Kein Produkt aus EFRO debug API geladen."
    );
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
  context?: SellerBrainContext; // Optional: Kontext für diesen Test
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

  // Anzahl der empfohlenen Produkte
  if (test.expected?.minCount !== undefined) {
    if (actualCount < test.expected.minCount) {
      issues.push(
        `count ${actualCount} < minCount ${test.expected.minCount}`
      );
    } else {
      passedChecks.push(`count >= ${test.expected.minCount}`);
    }
  }

  if (test.expected?.maxCount !== undefined) {
    if (actualCount > test.expected.maxCount) {
      issues.push(
        `count ${actualCount} > maxCount ${test.expected.maxCount}`
      );
    } else {
      passedChecks.push(`count <= ${test.expected.maxCount}`);
    }
  }

  // Preis-Minimum
  if (test.expected?.minPrice !== undefined && recommended.length > 0) {
    const minActualPrice = Math.min(
      ...recommended.map((p) => p.price ?? Infinity)
    );
    if (minActualPrice < test.expected.minPrice) {
      issues.push(
        `minPrice ${minActualPrice.toFixed(
          2
        )} < expected ${test.expected.minPrice}`
      );
    } else {
      passedChecks.push(`minPrice >= ${test.expected.minPrice}`);
    }
  }

  // Preis-Maximum
  if (test.expected?.maxPrice !== undefined && recommended.length > 0) {
    const maxActualPrice = Math.max(
      ...recommended.map((p) => p.price ?? 0)
    );
    if (maxActualPrice > test.expected.maxPrice) {
      issues.push(
        `maxPrice ${maxActualPrice.toFixed(
          2
        )} > expected ${test.expected.maxPrice}`
      );
    } else {
      passedChecks.push(`maxPrice <= ${test.expected.maxPrice}`);
    }
  }

  // Kategorie-Prüfung (deutsche & englische Varianten)
  if (test.expected?.categorySlug !== undefined && recommended.length > 0) {
    const categories = recommended
      .map((p) => (p.category || "").toLowerCase())
      .filter(Boolean);
    const expectedCategory = test.expected.categorySlug.toLowerCase();

    // Mapping deutsche Kategorie-Slugs → mögliche Texte im Katalog
    const categoryMap: Record<string, string[]> = {
      snowboard: ["snowboard", "snowboards", "board"],
      haustier: [
        "haustier",
        "tier",
        "tierbedarf",
        "pets",
        "pet",
        "dog",
        "cat",
        "hund",
        "katze",
        "animal",
        "bowl",
      ],
      kosmetik: [
        "kosmetik",
        "cosmetics",
        "cosmetic",
        "pflege",
        "beauty",
        "skincare",
        "shampoo",
        "duschgel",
        "cream",
        "creme",
      ],
      garten: ["garten", "garden", "outdoor", "gardening"],
      werkzeug: ["werkzeug", "tool", "tools", "diy", "hardware"],
      haushalt: [
        "haushalt",
        "household",
        "home",
        "kitchen",
        "küche",
        "haushaltsgeräte",
        "wasserkocher",
        "electric kettle",
        "kettle",
      ],
      elektronik: [
        "elektronik",
        "electronics",
        "smartphone",
        "phone",
        "handy",
        "tv",
        "fernseher",
      ],
      mode: [
        "mode",
        "fashion",
        "kleidung",
        "bekleidung",
        "clothes",
        "jeans",
        "hose",
        "t-shirt",
      ],
      perfume: ["perfume", "parfum", "parfüm", "duft", "eau de parfum"],
    };

    const expectedVariants = categoryMap[expectedCategory] || [expectedCategory];

    const hasCategory = categories.some((cat) =>
      expectedVariants.some(
        (variant) =>
          cat === variant ||
          cat.includes(variant) ||
          variant.includes(cat)
      )
    );

    if (!hasCategory) {
      issues.push(
        `category '${test.expected.categorySlug}' (variants: ${expectedVariants.join(
          ", "
        )}) not found in ${Array.from(new Set(categories)).join(", ")}`
      );
    } else {
      passedChecks.push(
        `category matches '${test.expected.categorySlug}'`
      );
    }
  }

  // priceRangeNoMatch
  if (test.expected?.expectNoMatchPriceRange !== undefined) {
    const actualNoMatch = result.priceRangeNoMatch ?? false;
    if (actualNoMatch !== test.expected.expectNoMatchPriceRange) {
      issues.push(
        `priceRangeNoMatch ${actualNoMatch} !== expected ${test.expected.expectNoMatchPriceRange}`
      );
    } else {
      passedChecks.push(`priceRangeNoMatch = ${actualNoMatch}`);
    }
  }

  // explanationMode
  if (test.expected?.expectExplanationMode !== undefined) {
    const hasExplanation = result.explanationMode === true;
    if (hasExplanation !== test.expected.expectExplanationMode) {
      issues.push(
        `explanationMode ${hasExplanation} !== expected ${test.expected.expectExplanationMode}`
      );
    } else {
      passedChecks.push(`explanationMode = ${hasExplanation}`);
    }
  }

  // AI-Trigger
  if (test.expected?.expectAiTrigger !== undefined) {
    const actualAiTrigger = result.aiTrigger?.needsAiHelp ?? false;
    if (actualAiTrigger !== test.expected.expectAiTrigger) {
      issues.push(
        `aiTrigger.needsAiHelp ${actualAiTrigger} !== expected ${test.expected.expectAiTrigger}`
      );
    } else {
      passedChecks.push(`aiTrigger = ${actualAiTrigger}`);
    }
  }

  // Intent
  if (test.expected?.expectIntent !== undefined) {
    if (result.intent !== test.expected.expectIntent) {
      issues.push(
        `intent '${result.intent}' !== expected '${test.expected.expectIntent}'`
      );
    } else {
      passedChecks.push(`intent = '${result.intent}'`);
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
  products: EfroProduct[],
  initialContext?: SellerBrainContext
): Promise<{ passed: boolean; details: string; result: SellerBrainResult }> {
  // Initialer SellerContext (analog zu avatar-seller/page.tsx)
  const sellerContext: SellerBrainContext =
    initialContext ?? test.context ?? {
      activeCategorySlug: null,
    };

  // Initialer Intent (analog UI)
  const initialIntent: ShoppingIntent = "quick_buy";

  // Plan (default "starter")
  const plan = "starter";

  const previousRecommended: EfroProduct[] = [];

  const result: SellerBrainResult = runSellerBrain(
    test.query,
    initialIntent,
    products,
    plan,
    previousRecommended,
    sellerContext
  );

  const evaluation = evaluateScenario(result, test);

  const recommended = result.recommended ?? [];
  const priceInfo = result.priceRangeInfo
    ? {
        userMinPrice: result.priceRangeInfo.userMinPrice,
        userMaxPrice: result.priceRangeInfo.userMaxPrice,
        categoryMinPrice: result.priceRangeInfo.categoryMinPrice,
        categoryMaxPrice: result.priceRangeInfo.categoryMaxPrice,
      }
    : null;

  console.log(
    `  Intent: ${result.intent}, Count: ${recommended.length}, priceRangeNoMatch: ${
      result.priceRangeNoMatch ?? false
    }`
  );
  if (priceInfo) {
    console.log(
      `  PriceRange: user(${priceInfo.userMinPrice ?? "null"}-${
        priceInfo.userMaxPrice ?? "null"
      }), category(${
        priceInfo.categoryMinPrice?.toFixed(2) ?? "null"
      }-${priceInfo.categoryMaxPrice?.toFixed(2) ?? "null"})`
    );
  }
  if (recommended.length > 0) {
    const categories = Array.from(
      new Set(recommended.map((p) => p.category || "unknown"))
    );
    console.log(`  Categories: ${categories.join(", ")}`);
  }

  return { ...evaluation, result };
}

/**
 * Hauptfunktion
 */
async function main() {
  try {
    console.log("=== EFRO SellerBrain Szenario-Test (Super Crash Test) ===");
    console.log();

    const products = await loadTestProducts();
    console.log();

    const tests: ScenarioTest[] = [
      // =========================================================
      // GRUPPE S – ursprüngliche Szenarien (Snowboard, Haustier, Wax, Fressnapf, etc.)
      // =========================================================
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
        query:
          "Ich suche etwas für meinen Hund – am besten einen Napf oder etwas für Futter.",
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
        title:
          "Gesichtscreme für trockene Haut – eher hochwertig (20–30 €)",
        query:
          "Ich suche eine hochwertige Gesichtscreme für trockene Haut, so um die 20 bis 30 Euro.",
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
        query:
          "Ich brauche ein Geschenk für einen Heimwerker – irgendwas mit Werkzeug, aber nicht über 100 Euro.",
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
        query:
          "Ich suche günstige Snowboard-Bindungen für Einsteiger.",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S16",
        title: "Fressnapf (unbekannter Begriff)",
        query: "Hast du Näpfe wie bei Fressnapf für meinen Hund?",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "S17",
        title: "Wax ohne Kategorie, einfache Produktsuche",
        query: "Ich suche ein gutes Wax für meine Haare.",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S18",
        title: "Wax-Erklärung mit vorhandener Beschreibung",
        query: "Wie wende ich dieses Wax am besten an?",
        expected: {
          expectExplanationMode: true,
          expectAiTrigger: false,
        },
      },
      {
        id: "S19",
        title: "Wax-Erklärung ohne Beschreibung",
        query: "Wie genau funktioniert dieses Wax?",
        expected: {
          expectExplanationMode: true,
          expectAiTrigger: false,
        },
      },
      {
        id: "S20",
        title: "Mischsatz Fressnapf + Budget",
        query:
          "Ich brauche etwas für meinen Hund, am liebsten wie bei Fressnapf, aber es soll unter 20 Euro bleiben.",
        expected: {
          minCount: 0,
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
      {
        id: "S22",
        title: "Snowboard-Wachs korrekt",
        query:
          "Ich brauche Wax für mein Snowboard, damit es schneller wird. Was empfiehlst du?",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S23",
        title: "Wax für Haare – kein Haarwachs im Shop",
        query: "Ich suche ein gutes Wax für meine Haare. Hast du sowas?",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "S24",
        title: "Mischsatz – NICHT Haare, sondern Snowboard",
        query:
          "Ich brauche Wax – aber NICHT für meine Haare, sondern für mein Snowboard.",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S25",
        title:
          "Fressnapf – Produkt vorhanden, aber ohne 'Fressnapf' im Titel",
        query: "Ich suche einen Fressnapf für meinen Hund.",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "S26",
        title: "Kein Match – ehrliche Antwort (Haarwax mit Kokosduft)",
        query: "Hast du Wax für meine Haare mit Kokosduft?",
        expected: {
          minCount: 0,
        },
      },

      // =========================================================
      // GRUPPE A/B/C/D – Kontext- und Budget-Tests (Parfüm, Snowboard, Haushalt, Haustier …)
      // =========================================================
      {
        id: "A1",
        title: "Snowboard + Budget (Kontext)",
        query: "Mein Budget ist 1000 Euro.",
        context: { activeCategorySlug: "snowboard" },
        expected: {
          minCount: 1,
          maxPrice: 1000,
          categorySlug: "snowboard",
        },
      },
      {
        id: "A2",
        title: "Haustier + Budget (Kontext)",
        query: "Ich möchte so um die 50 Euro ausgeben.",
        context: { activeCategorySlug: "haustier" },
        expected: {
          minCount: 1,
          maxPrice: 50,
          categorySlug: "haustier",
        },
      },
      {
        id: "B1",
        title: "Haustier → Premium (Kontext)",
        query: "Zeig mir Premium.",
        context: { activeCategorySlug: "haustier" },
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "haustier",
        },
      },
      {
        id: "B2",
        title: "Snowboards → günstigste (Kontext)",
        query: "Zeig mir die günstigsten.",
        context: { activeCategorySlug: "snowboard" },
        expected: {
          minCount: 1,
          expectIntent: "bargain",
          categorySlug: "snowboard",
        },
      },
      {
        id: "C1",
        title: "Global 'teuersten Produkte'",
        query: "Zeige mir die teuersten Produkte.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "D1",
        title: "Parfüm → Start",
        query: "Zeige mir Parfüm.",
        expected: {
          minCount: 1,
          categorySlug: "perfume",
        },
      },
      {
        id: "D2",
        title: "Parfüm → Budget (Kontext)",
        query: "Ich habe nur 50 Euro.",
        context: { activeCategorySlug: "perfume" },
        expected: {
          minCount: 1,
          maxPrice: 50,
          categorySlug: "perfume",
        },
      },
      {
        id: "D3",
        title: "Parfüm → Premium (Kontext)",
        query: "Zeige mir Premium.",
        context: { activeCategorySlug: "perfume" },
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "perfume",
        },
      },
      {
        id: "D4",
        title: "Snowboard → Start",
        query: "Zeig mir Snowboards.",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "D5",
        title: "Snowboard → Budget (Kontext)",
        query: "Mein Budget liegt bei 1000 Euro.",
        context: { activeCategorySlug: "snowboard" },
        expected: {
          minCount: 1,
          maxPrice: 1000,
          categorySlug: "snowboard",
        },
      },
      {
        id: "D6",
        title: "Snowboard → Premium (Kontext)",
        query: "Zeig mir Premium-Produkte.",
        context: { activeCategorySlug: "snowboard" },
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "snowboard",
        },
      },
      {
        id: "D7",
        title: "Haushalt → Start",
        query: "Zeige mir etwas für den Haushalt.",
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "D8",
        title: "Haushalt → Budget (Kontext)",
        query: "Ich möchte nicht mehr als 30 Euro ausgeben.",
        context: { activeCategorySlug: "haushalt" },
        expected: {
          minCount: 1,
          maxPrice: 30,
          categorySlug: "haushalt",
        },
      },

      // =========================================================
      // GRUPPE E/F/G/H/I/J – AI-Trigger, Premium, Budget, Kategorien, Edge Cases
      // (wie in deinem Script schon angelegt – leicht bereinigt)
      // =========================================================
      {
        id: "E1",
        title: "Unbekannter Fantasiebegriff 'Zephyron'",
        query: "Hast du etwas mit 'Zephyron'?",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "E2",
        title: "Unbekannter Begriff + Kategorie",
        query: "Zeige mir Zephyron-Parfüm.",
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E3",
        title: "Unbekannter Begriff + Budget",
        query: "Ich suche Zephyron unter 50 Euro.",
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E4",
        title: "Unbekannter Markenname 'Luxuria'",
        query: "Hast du Produkte von 'Luxuria'?",
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E5",
        title: "Unbekannter Begriff mit Kontext Parfüm",
        query: "Zeige mir Zephyron.",
        context: { activeCategorySlug: "perfume" },
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "F1",
        title: "Premium-Produkte global",
        query: "Zeige mir Premium-Produkte.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "F2",
        title: "Premium-Parfüm (explizit)",
        query: "Zeige mir Premium-Parfüm.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "perfume",
        },
      },
      {
        id: "F3",
        title: "Premium-Parfüm mit Kontext",
        query: "Zeige mir Premium.",
        context: { activeCategorySlug: "perfume" },
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "perfume",
        },
      },
      {
        id: "F4",
        title: "Teuerstes Produkt global",
        query: "Zeige mir das teuerste Produkt.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "F5",
        title: "Günstigstes Produkt global",
        query: "Zeige mir das günstigste Produkt.",
        expected: {
          minCount: 1,
          expectIntent: "bargain",
        },
      },
      {
        id: "F6",
        title: "Teuerstes Snowboard",
        query: "Zeige mir das teuerste Snowboard.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "snowboard",
        },
      },
      {
        id: "F7",
        title: "Günstigstes Parfüm",
        query: "Zeige mir das günstigste Parfüm.",
        expected: {
          minCount: 1,
          expectIntent: "bargain",
          categorySlug: "perfume",
        },
      },
      {
        id: "G1",
        title: "Budget über 100 Euro",
        query: "Ich möchte über 100 Euro ausgeben.",
        expected: {
          minCount: 1,
          minPrice: 100,
        },
      },
      {
        id: "G2",
        title: "Budget zwischen 50 und 100 Euro",
        query: "Mein Budget liegt zwischen 50 und 100 Euro.",
        expected: {
          minCount: 1,
          minPrice: 50,
          maxPrice: 100,
        },
      },
      {
        id: "G3",
        title: "Budget unter 20 Euro",
        query: "Ich habe nur 20 Euro.",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "G4",
        title: "Budget mit Kontext Parfüm",
        query: "Ich habe nur 50 Euro.",
        context: { activeCategorySlug: "perfume" },
        expected: {
          minCount: 1,
          maxPrice: 50,
          categorySlug: "perfume",
        },
      },
      {
        id: "G5",
        title: "Budget mit Kontext Snowboard",
        query: "Mein Budget ist 800 Euro.",
        context: { activeCategorySlug: "snowboard" },
        expected: {
          minCount: 1,
          maxPrice: 800,
          categorySlug: "snowboard",
        },
      },
      {
        id: "H1",
        title: "Kosmetik-Produkte allgemein",
        query: "Zeige mir Kosmetik-Produkte.",
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "H2",
        title: "Garten-Produkte allgemein",
        query: "Ich suche etwas für den Garten.",
        expected: {
          minCount: 1,
          categorySlug: "garten",
        },
      },
      {
        id: "H3",
        title: "Werkzeug-Produkte",
        query: "Zeige mir Werkzeug.",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "H4",
        title: "Fashion-Produkte",
        query: "Ich suche Kleidung.",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "H5",
        title: "Elektronik-Produkte",
        query: "Hast du Elektronik?",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "I1",
        title: "Premium-Parfüm unter 100 Euro",
        query: "Zeige mir Premium-Parfüm unter 100 Euro.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          maxPrice: 100,
          categorySlug: "perfume",
        },
      },
      {
        id: "I2",
        title: "Günstiges Snowboard über 500 Euro",
        query: "Zeige mir ein günstiges Snowboard über 500 Euro.",
        expected: {
          minCount: 1,
          minPrice: 500,
          categorySlug: "snowboard",
        },
      },
      {
        id: "I3",
        title: "Geschenk für Hund unter 30 Euro",
        query: "Ich brauche ein Geschenk für meinen Hund unter 30 Euro.",
        expected: {
          minCount: 1,
          maxPrice: 30,
          categorySlug: "haustier",
        },
      },
      {
        id: "I4",
        title: "Premium-Haustierprodukt",
        query: "Zeige mir Premium-Produkte für Haustiere.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "haustier",
        },
      },
      {
        id: "I5",
        title: "Teuerstes Parfüm unter 200 Euro",
        query: "Zeige mir das teuerste Parfüm unter 200 Euro.",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          maxPrice: 200,
          categorySlug: "perfume",
        },
      },
      {
        id: "J1",
        title: "Sehr hohes Budget",
        query: "Ich habe 10000 Euro zur Verfügung.",
        expected: {
          minCount: 0,
          // KEIN AI-Trigger: EFRO soll nach Kategorie fragen, statt zufällige Produkte zu raten
          expectAiTrigger: false,
        },
      },
      {
        id: "J2",
        title: "Sehr niedriges Budget",
        query: "Ich habe nur 5 Euro.",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "J3",
        title: "Budget ohne Zahl",
        query: "Ich habe ein kleines Budget.",
        expected: {
          minCount: 0,
          // KEIN AI-Trigger: EFRO soll regelbasiert eine Rückfrage stellen
          expectAiTrigger: false,
        },
      },
      {
        id: "J4",
        title: "Leere Anfrage",
        query: "",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "J5",
        title: "Nur Zahlen",
        query: "50",
        expected: {
          minCount: 0,
        },
      },

      // =========================================================
      // GRUPPE K – NEU: Wasserkocher / Smartphone / Mode-Kontext (dein aktueller Debug-Case)
      // =========================================================
      {
        id: "K1",
        title: "Wasserkocher – Basis",
        query: "Ich suche Wasserkocher.",
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K2",
        title: "Günstige Wasserkocher unter 25 Euro",
        query: "Zeig mir bitte die günstigsten Wasserkocher unter 25 Euro.",
        expected: {
          minCount: 1,
          maxPrice: 25,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K3",
        title: "Premium-Wasserkocher ab 60 Euro",
        query: "Hast du auch Premium-Wasserkocher ab 60 Euro?",
        expected: {
          minCount: 1,
          minPrice: 60,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K4",
        title: "Wasserkocher unrealistisches Budget (5 €)",
        query: "Ich möchte einen Wasserkocher für maximal 5 Euro.",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K5",
        title: "Smartphone – Basis",
        query: "Ich suche ein Smartphone.",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K6",
        title: "Smartphone Alpha exakter Name",
        query: "Ich suche das Smartphone Alpha 128GB Schwarz.",
        expected: {
          minCount: 1,
          maxCount: 2,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K7",
        title: "Smartphone – Attribute (Farbe, Zoll) mit Kontext",
        query: "Es soll die Farbe schwarz haben, modern mit 6,5 Zoll Display.",
        context: { activeCategorySlug: "elektronik" },
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K8",
        title: "Smartphone – Budget-Filter im Kontext",
        query: "Zeig mir davon bitte die Modelle zwischen 200 und 400 Euro.",
        context: { activeCategorySlug: "elektronik" },
        expected: {
          minCount: 1,
          minPrice: 200,
          maxPrice: 400,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K9",
        title: "Teuerstes Smartphone im Shop",
        query: "Welches ist das teuerste Smartphone, das du im Shop hast?",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K10",
        title: "Mode – Slim Fit Jeans",
        query: "Ich suche eine blaue Slim Fit Jeans.",
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K11",
        title: "Mode – genau ein Produkt (keine Fallbacks)",
        query: "Zeig mir nur die Slim Fit Jeans Blau.",
        expected: {
          minCount: 1,
          maxCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K12",
        title: "Mode – günstigste Jeans",
        query: "Welche ist die günstigste Jeans, die du hast?",
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K13",
        title: "Mode – unrealistisches Budget (unter 6 €)",
        query: "Hast du eine Jeans für unter 6 Euro?",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "mode",
        },
      },
      {
        id: "K14",
        title: "Kontextwechsel Mode → Elektronik",
        query: "Ich suche eine schwarze Jeans.",
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K15",
        title: "Kontextwechsel Mode → Elektronik (explizit)",
        query: "Okay, zeig mir statt Jeans lieber ein Smartphone unter 300 Euro.",
        context: { activeCategorySlug: "mode" },
        expected: {
          minCount: 1,
          maxPrice: 300,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K16",
        title: "Fake-Smartphone nicht im Katalog",
        query: "Ich suche das Smartphone Alpha ULTRA PRO 1TB mit 7 Zoll.",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "K17",
        title: "Fake-Wasserkocher nicht im Katalog",
        query: "Hast du den Wasserkocher 'HyperBoil ZX-9000'?",
        expected: {
          minCount: 0,
          expectAiTrigger: true,
          categorySlug: "haushalt",
        },
      },
    ];

    const results: Array<{
      test: ScenarioTest;
      passed: boolean;
      details: string;
    }> = [];

    for (const test of tests) {
      console.log(`\n[${test.id}] ${test.title}`);
      console.log(`Query: "${test.query}"`);

      const evaluation = await runScenarioTest(
        test,
        products,
        test.context
      );

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

    // Exit-Code: 0 wenn alle bestanden, 1 sonst
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
