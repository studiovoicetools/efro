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
import { type SalesAction } from "../src/lib/sales/salesTypes";
import { normalizeUserInput } from "../src/lib/sales/modules/utils";

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
  // zusätzliche Varianten derselben Frage, die alle zum selben erwarteten Ergebnis führen sollen
  variantQueries?: string[];
  /**
   * Optionale Varianten dieses Szenarios (z. B. Tippfehler, Umgangssprache,
   * andere Formulierungen mit identischer Erwartung).
   * Wird in einem späteren Schritt vom Runner genutzt, aktuell nur Struktur.
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

  // Sales-Policy: PrimaryAction (optional)
  if (test.expected?.expectedPrimaryAction !== undefined) {
    // @ts-ignore - sales-Feld kann noch nicht im SellerBrainResult-Typ sein
    const got = result.sales?.primaryAction;
    if (got !== test.expected.expectedPrimaryAction) {
      issues.push(
        `expected primaryAction=${test.expected.expectedPrimaryAction}, got=${got ?? "undefined"}`
      );
    } else {
      passedChecks.push(`primaryAction = '${got}'`);
    }
  }

  // Sales-Policy: Notes (optional)
  if (test.expected?.expectedNotesIncludes && test.expected.expectedNotesIncludes.length > 0) {
    // @ts-ignore - sales-Feld kann noch nicht im SellerBrainResult-Typ sein
    const notes = result.sales?.notes ?? [];
    for (const expectedNote of test.expected.expectedNotesIncludes) {
      if (!notes.includes(expectedNote)) {
        issues.push(
          `expected sales.notes to include "${expectedNote}" but got [${notes.join(", ")}]`
        );
      } else {
        passedChecks.push(`notes includes "${expectedNote}"`);
      }
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

  // D8-spezifische Prüfungen: priceRangeInfo validieren
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

      // Prüfe, dass Produkte aufsteigend nach Preis sortiert sind
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

    // Prüfe Intent
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
 * Hauptfunktion
 */
async function main() {
  try {
    console.log("=== EFRO SellerBrain Szenario-Test (Super Crash Test) ===");
    console.log();

    const products = await loadTestProducts();
    console.log();

    const baseTests: ScenarioTest[] = [
      // =========================================================
      // GRUPPE S – ursprüngliche Szenarien (Snowboard, Haustier, Wax, Fressnapf, etc.)
      // =========================================================
      {
        id: "S1",
        title: "Snowboards unter 300 Euro – nichts im Katalog",
        query: "Zeig mir Snowboards unter 300 Euro.",
        variantQueries: [
          "Ich suche ein günstiges Snowboard, höchstens 300 €.",
          "Hast du Snowboards bis 300 Euro im Angebot?",
          "hast du snowbords bis 300 euro? brauche was günstıges für den anfang.",
          "gib mir mal ein snowbord unter 300e, nix zu teures bitte.",
          "hast du ein board für anfänger so bis ungefähr 300 euro?",
          "ich such ein guenstıges snowboard max 300 eur, eher einsteiger-modell.",
        ],
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
        variantQueries: [
          "Zeig mir bitte ein Premium-Snowboard ab 800 Euro aufwärts.",
          "Ich suche ein hochwertiges Board, mindestens 800 Euro.",
        ],
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
        variantQueries: [
          "Ich habe 700 Euro für ein Snowboard zur Verfügung.",
          "Was kostet ein Snowboard, wenn ich maximal 700 Euro ausgeben möchte?",
        ],
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
        variantQueries: [
          "Ich suche ein Snowboard im Preisbereich von 600 bis 900 Euro.",
          "Hast du Boards zwischen 600 und 900 €?",
        ],
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
        variantQueries: [
          "Was ist dein billigstes Snowboard?",
          "Zeig mir das preiswerteste Board, das du hast.",
          "hast du ein richtig günstıges snowbord für mich?",
          "welches snowbord ist bei dir am billigsten?",
          "zeig mir mal dein cheapstes snowboard, egal welche marke.",
          "ich brauch nur ein einsteiger-board, so billig wie möglich.",
        ],
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
        variantQueries: [
          "Was ist dein teuerstes Snowboard?",
          "Zeig mir das Premium-Modell mit dem höchsten Preis.",
        ],
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
        variantQueries: [
          "Hast du Hundezubehör wie Näpfe oder Futterbehälter?",
          "Ich brauche etwas für meinen Vierbeiner, am besten für Futter oder Wasser.",
          "hast du was fuer meinen hund, z.b. napf oder futterschale?",
          "ich such was fuers wuffi, irgendwas fuer futter oder wasser.",
          "gibts bei dir hunde-naepfe oder futter-schuesseln?",
          "brauche was fuer meinen hund zum fressen, napf oder aehnlich.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "S8",
        title: "Günstiges Duschgel unter 10 Euro",
        query: "Zeig mir bitte ein günstiges Duschgel unter 10 Euro.",
        variantQueries: [
          "Hast du ein preiswertes Duschgel bis 10 €?",
          "Ich suche ein günstiges Duschgel, maximal 10 Euro.",
          "hast du ein duschgel so bis 10 euro, nix teures?",
          "ich brauch ein guenstıges duschgel, maximal nen zehner.",
          "gib mir mal ein einfaches duschgel, preisrahmen bis 10€.",
          "such was zum duschen, guenstig und unter 10 eur.",
        ],
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
        variantQueries: [
          "Zeig mir bitte eine gute Gesichtscreme für trockene Haut zwischen 20 und 30 Euro.",
          "Ich brauche eine qualitativ hochwertige Creme für trockene Haut, Preisbereich 20-30 €.",
          "ich such eine gute gesıchtscreme fuer trockene haut, so 20-30 euro.",
          "hast du face cream fuer trockene haut in der preisklasse 20 bis 30 eur?",
          "brauche was fuer trockene haut im gesicht, budget um die 25 euro.",
          "zeig mir bitte eine hochwertige creme fuer trockene haut so im bereich 20-30€.",
        ],
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
        variantQueries: [
          "Zeig mir bitte Gartenartikel bis 20 Euro.",
          "Ich suche etwas für meinen Garten, maximal 20 €.",
        ],
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
        variantQueries: [
          "Was kannst du mir für einen Heimwerker empfehlen? Etwas mit Werkzeug, bis 100 Euro.",
          "Ich suche ein Geschenk für jemanden, der gerne bastelt. Werkzeug wäre gut, maximal 100 €.",
        ],
        expected: {
          minCount: 1,
          maxPrice: 100,
        },
      },
      {
        id: "S12",
        title: "Erklärung zur Anwendung von Snowboard-Wachs",
        query: "Erklär mir bitte, wie ich Snowboard-Wachs richtig benutze.",
        variantQueries: [
          "Wie wende ich Snowboard-Wachs korrekt an?",
          "Kannst du mir erklären, wie man Snowboardwachs verwendet?",
        ],
        expected: {
          expectExplanationMode: true,
        },
      },
      {
        id: "S13",
        title: "Budget-Only Anfrage mit Shampoo",
        query: "Mein Budget für Shampoo liegt bei 15 Euro. Was hast du da?",
        variantQueries: [
          "Ich habe 15 Euro für Shampoo zur Verfügung. Was kannst du mir zeigen?",
          "Was für Shampoos hast du bis 15 Euro?",
        ],
        expected: {
          minCount: 1,
          maxPrice: 15,
        },
      },
      {
        id: "S14",
        title: "Unbekannter Begriff + Budget",
        query: "Zeig mir bitte Produkte für XY-9000 unter 50 Euro.",
        variantQueries: [
          "Hast du etwas für XY-9000 bis 50 Euro?",
          "Ich suche XY-9000, maximal 50 €.",
        ],
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "S15",
        title: "Snowboard-Bindungen für Einsteiger",
        query:
          "Ich suche günstige Snowboard-Bindungen für Einsteiger.",
        variantQueries: [
          "Zeig mir bitte preiswerte Bindungen für Snowboard-Anfänger.",
          "Hast du günstige Snowboard-Bindungen für Einsteiger?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "S16",
        title: "Fressnapf (unbekannter Begriff)",
        query: "Hast du Näpfe wie bei Fressnapf für meinen Hund?",
        variantQueries: [
          "Ich suche Hundebowls wie bei Fressnapf.",
          "Hast du Fressnapf-ähnliche Näpfe für Hunde?",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "S17",
        title: "Wax ohne Kategorie, einfache Produktsuche",
        query: "Ich suche ein gutes Wax für meine Haare.",
        variantQueries: [
          "Zeig mir bitte ein gutes Haare-Wachs.",
          "Hast du ein qualitatives Wax für die Haare?",
        ],
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S18",
        title: "Wax-Erklärung mit vorhandener Beschreibung",
        query: "Wie wende ich dieses Wax am besten an?",
        variantQueries: [
          "Kannst du mir erklären, wie ich dieses Wax richtig verwende?",
          "Wie benutze ich dieses Wax korrekt?",
        ],
        expected: {
          expectExplanationMode: true,
          expectAiTrigger: false,
        },
      },
      {
        id: "S19",
        title: "Wax-Erklärung ohne Beschreibung",
        query: "Wie genau funktioniert dieses Wax?",
        variantQueries: [
          "Erklär mir bitte, wie dieses Wax funktioniert.",
          "Wie wird dieses Wax angewendet?",
        ],
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
        variantQueries: [
          "Hast du Fressnapf-ähnliche Produkte für Hunde bis 20 Euro?",
          "Ich suche etwas für meinen Hund wie bei Fressnapf, maximal 20 €.",
        ],
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
        variantQueries: [
          "Zeig mir bitte Xyloklum-Produkte.",
          "Ich suche etwas mit Xyloklum.",
        ],
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
        variantQueries: [
          "Welches Wachs empfiehlst du für mein Snowboard?",
          "Hast du Snowboardwachs zum Belag pflegen?",
        ],
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S23",
        title: "Wax für Haare – kein Haarwachs im Shop",
        query: "Ich suche ein gutes Wax für meine Haare. Hast du sowas?",
        variantQueries: [
          "Hast du Haare-Wachs?",
          "Zeig mir bitte Wax für die Haare.",
        ],
        expected: {
          minCount: 0,
        },
      },
      {
        id: "S24",
        title: "Mischsatz – NICHT Haare, sondern Snowboard",
        query:
          "Ich brauche Wax – aber NICHT für meine Haare, sondern für mein Snowboard.",
        variantQueries: [
          "Ich suche Wachs, nicht für Haare, sondern für mein Snowboard.",
          "Hast du Wax für Snowboards? Nicht für Haare!",
        ],
        expected: {
          minCount: 1,
        },
      },
      {
        id: "S25",
        title:
          "Fressnapf – Produkt vorhanden, aber ohne 'Fressnapf' im Titel",
        query: "Ich suche einen Fressnapf für meinen Hund.",
        variantQueries: [
          "Hast du Fressnapf-Produkte für Hunde?",
          "Ich brauche einen Fressnapf-Napf für meinen Vierbeiner.",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "S26",
        title: "Kein Match – ehrliche Antwort (Haarwax mit Kokosduft)",
        query: "Hast du Wax für meine Haare mit Kokosduft?",
        variantQueries: [
          "Ich suche Haare-Wachs mit Kokosduft.",
          "Zeig mir bitte Wax für Haare, das nach Kokos riecht.",
        ],
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
        variantQueries: [
          "Ich habe 1000 Euro zur Verfügung.",
          "Was kostet maximal 1000 Euro?",
        ],
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
        variantQueries: [
          "Mein Budget liegt bei etwa 50 Euro.",
          "Ich habe ungefähr 50 € zur Verfügung.",
        ],
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
        variantQueries: [
          "Ich möchte die Premium-Variante sehen.",
          "Zeig mir bitte die hochwertigsten Produkte.",
        ],
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
        variantQueries: [
          "Was sind die preiswertesten?",
          "Zeig mir bitte die billigsten Produkte.",
        ],
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
        variantQueries: [
          "Was sind deine teuersten Artikel?",
          "Zeig mir die Premium-Produkte mit dem höchsten Preis.",
        ],
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "D1",
        title: "Parfüm → Start",
        query: "Zeige mir Parfüm.",
        variantQueries: [
          "Ich suche Parfum.",
          "Hast du Duftstoffe oder Parfüms?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "perfume",
        },
      },
      {
        id: "D2",
        title: "Parfüm → Budget (Kontext)",
        query: "Ich habe nur 50 Euro.",
        variantQueries: [
          "Mein Budget liegt bei 50 Euro.",
          "Ich kann maximal 50 € ausgeben.",
        ],
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
        variantQueries: [
          "Ich möchte die Premium-Variante sehen.",
          "Zeig mir bitte die hochwertigsten Parfüms.",
        ],
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
        variantQueries: [
          "Ich suche Snowboards.",
          "Hast du Boards zum Snowboarden?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "D5",
        title: "Snowboard → Budget (Kontext)",
        query: "Mein Budget liegt bei 1000 Euro.",
        variantQueries: [
          "Ich habe 1000 Euro zur Verfügung.",
          "Was kostet maximal 1000 Euro?",
        ],
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
        variantQueries: [
          "Ich möchte die Premium-Variante sehen.",
          "Zeig mir bitte die hochwertigsten Snowboards.",
        ],
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
        variantQueries: [
          "Ich suche Haushaltsartikel.",
          "Hast du etwas für den Haushalt?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "D8",
        title: "Haushalt → Budget (Kontext)",
        query: "Ich möchte nicht mehr als 30 Euro ausgeben.",
        variantQueries: [
          "Mein Budget liegt bei maximal 30 Euro.",
          "Ich kann höchstens 30 € ausgeben.",
        ],
        context: { activeCategorySlug: "haushalt" },
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
          expectNoMatchPriceRange: true,
          // D8 Budget-Mismatch-Fallback: Zeigt Produkte aus Kategorie trotz Budget-Mismatch
          // maxPrice-Prüfung entfernt, da Produkte über Budget gezeigt werden sollen
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
        variantQueries: [
          "Zeig mir bitte Zephyron-Produkte.",
          "Ich suche etwas mit Zephyron.",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "E2",
        title: "Unbekannter Begriff + Kategorie",
        query: "Zeige mir Zephyron-Parfüm.",
        variantQueries: [
          "Hast du Zephyron-Parfum?",
          "Ich suche Zephyron-Duft.",
        ],
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E3",
        title: "Unbekannter Begriff + Budget",
        query: "Ich suche Zephyron unter 50 Euro.",
        variantQueries: [
          "Hast du Zephyron bis 50 €?",
          "Zeig mir Zephyron, maximal 50 Euro.",
        ],
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E4",
        title: "Unbekannter Markenname 'Luxuria'",
        query: "Hast du Produkte von 'Luxuria'?",
        variantQueries: [
          "Zeig mir bitte Luxuria-Artikel.",
          "Ich suche Produkte der Marke Luxuria.",
        ],
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "E5",
        title: "Unbekannter Begriff mit Kontext Parfüm",
        query: "Zeige mir Zephyron.",
        variantQueries: [
          "Ich suche Zephyron.",
          "Hast du Zephyron?",
        ],
        context: { activeCategorySlug: "perfume" },
        expected: {
          expectAiTrigger: true,
        },
      },
      {
        id: "F1",
        title: "Premium-Produkte global",
        query: "Zeige mir Premium-Produkte.",
        variantQueries: [
          "Ich möchte die Premium-Variante sehen.",
          "Zeig mir bitte die hochwertigsten Produkte.",
        ],
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "F2",
        title: "Premium-Parfüm (explizit)",
        query: "Zeige mir Premium-Parfüm.",
        variantQueries: [
          "Ich suche hochwertiges Parfum.",
          "Zeig mir bitte Premium-Duft.",
        ],
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
        variantQueries: [
          "Ich möchte die Premium-Variante sehen.",
          "Zeig mir bitte die hochwertigsten Parfüms.",
        ],
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
        variantQueries: [
          "Was ist dein teuerstes Produkt?",
          "Zeig mir bitte das Premium-Modell mit dem höchsten Preis.",
        ],
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "F5",
        title: "Günstigstes Produkt global",
        query: "Zeige mir das günstigste Produkt.",
        variantQueries: [
          "Was ist dein billigstes Produkt?",
          "Zeig mir bitte das preiswerteste, das du hast.",
        ],
        expected: {
          minCount: 1,
          expectIntent: "bargain",
        },
      },
      {
        id: "F6",
        title: "Teuerstes Snowboard",
        query: "Zeige mir das teuerste Snowboard.",
        variantQueries: [
          "Was ist dein teuerstes Snowboard?",
          "Zeig mir bitte das Premium-Board mit dem höchsten Preis.",
        ],
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
        variantQueries: [
          "Was ist dein billigstes Parfum?",
          "Zeig mir bitte das preiswerteste Parfüm.",
        ],
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
        variantQueries: [
          "Ich suche Produkte ab 100 Euro aufwärts.",
          "Zeig mir bitte Artikel, die mindestens 100 Euro kosten.",
        ],
        expected: {
          minCount: 1,
          minPrice: 100,
        },
      },
      {
        id: "G2",
        title: "Budget zwischen 50 und 100 Euro",
        query: "Mein Budget liegt zwischen 50 und 100 Euro.",
        variantQueries: [
          "Ich suche etwas im Preisbereich von 50 bis 100 Euro.",
          "Was kostet zwischen 50 und 100 €?",
        ],
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
        variantQueries: [
          "Mein Budget liegt bei 20 Euro.",
          "Ich kann maximal 20 € ausgeben.",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "G4",
        title: "Budget mit Kontext Parfüm",
        query: "Ich habe nur 50 Euro.",
        variantQueries: [
          "Mein Budget liegt bei 50 Euro.",
          "Ich kann maximal 50 € ausgeben.",
        ],
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
        variantQueries: [
          "Ich habe 800 Euro zur Verfügung.",
          "Was kostet maximal 800 Euro?",
        ],
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
        variantQueries: [
          "Ich suche Kosmetik.",
          "Hast du Beauty-Produkte?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "H2",
        title: "Garten-Produkte allgemein",
        query: "Ich suche etwas für den Garten.",
        variantQueries: [
          "Zeig mir bitte Gartenartikel.",
          "Hast du etwas für meinen Garten?",
        ],
        expected: {
          minCount: 1,
          categorySlug: "garten",
        },
      },
      {
        id: "H3",
        title: "Werkzeug-Produkte",
        query: "Zeige mir Werkzeug.",
        variantQueries: [
          "Ich suche Werkzeuge.",
          "Hast du Tools oder Werkzeug?",
        ],
        expected: {
          minCount: 1,
        },
      },
      {
        id: "H4",
        title: "Fashion-Produkte",
        query: "Ich suche Kleidung.",
        variantQueries: [
          "Zeig mir bitte Mode.",
          "Hast du Bekleidung?",
        ],
        expected: {
          minCount: 0,
        },
      },
      {
        id: "H5",
        title: "Elektronik-Produkte",
        query: "Hast du Elektronik?",
        variantQueries: [
          "Zeig mir bitte Elektronik-Artikel.",
          "Ich suche elektronische Geräte.",
        ],
        expected: {
          minCount: 0,
        },
      },
      {
        id: "I1",
        title: "Premium-Parfüm unter 100 Euro",
        query: "Zeige mir Premium-Parfüm unter 100 Euro.",
        variantQueries: [
          "Ich suche hochwertiges Parfum bis 100 €.",
          "Zeig mir Premium-Duft, maximal 100 Euro.",
        ],
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
        variantQueries: [
          "Ich suche ein preiswertes Board ab 500 Euro.",
          "Zeig mir bitte ein günstiges Snowboard, mindestens 500 €.",
        ],
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
        variantQueries: [
          "Was kannst du mir für meinen Hund empfehlen? Bis 30 Euro.",
          "Ich suche ein Geschenk für meinen Vierbeiner, maximal 30 €.",
        ],
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
        variantQueries: [
          "Ich suche hochwertige Haustierprodukte.",
          "Zeig mir bitte Premium-Artikel für Tiere.",
        ],
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
        variantQueries: [
          "Was ist dein teuerstes Parfum bis 200 €?",
          "Zeig mir bitte das Premium-Parfüm mit dem höchsten Preis unter 200 Euro.",
        ],
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
        variantQueries: [
          "Mein Budget liegt bei 10000 Euro.",
          "Ich kann bis zu 10000 € ausgeben.",
        ],
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
        variantQueries: [
          "Mein Budget liegt bei 5 Euro.",
          "Ich kann maximal 5 € ausgeben.",
        ],
        expected: {
          minCount: 0,
        },
      },
      {
        id: "J3",
        title: "Budget ohne Zahl",
        query: "Ich habe ein kleines Budget.",
        variantQueries: [
          "Mein Budget ist begrenzt.",
          "Ich habe nicht viel Geld zur Verfügung.",
        ],
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
        variantQueries: [
          " ",
          "   ",
        ],
        expected: {
          minCount: 0,
        },
      },
      {
        id: "J5",
        title: "Nur Zahlen",
        query: "50",
        variantQueries: [
          "100",
          "25",
        ],
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
        variantQueries: [
          "Hast du Wasserkocher?",
          "Zeig mir bitte Kocher für Wasser.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K2",
        title: "Günstige Wasserkocher unter 25 Euro",
        query: "Zeig mir bitte die günstigsten Wasserkocher unter 25 Euro.",
        variantQueries: [
          "Ich suche preiswerte Wasserkocher bis 25 €.",
          "Hast du günstige Kocher, maximal 25 Euro?",
        ],
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "haushalt",
        },
      },
      {
        id: "K3",
        title: "Premium-Wasserkocher ab 60 Euro",
        query: "Hast du auch Premium-Wasserkocher ab 60 Euro?",
        variantQueries: [
          "Zeig mir hochwertige Wasserkocher ab 60 €.",
          "Ich suche Premium-Kocher, mindestens 60 Euro.",
        ],
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
        variantQueries: [
          "Hast du Wasserkocher bis 5 €?",
          "Ich suche einen Kocher, höchstens 5 Euro.",
        ],
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
        variantQueries: [
          "Hast du Smartphones?",
          "Zeig mir bitte Handys.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K6",
        title: "Smartphone Alpha exakter Name",
        query: "Ich suche das Smartphone Alpha 128GB Schwarz.",
        variantQueries: [
          "Hast du das Smartphone Alpha 128GB in Schwarz?",
          "Zeig mir bitte das Alpha 128GB Schwarz.",
        ],
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
        variantQueries: [
          "Ich möchte ein schwarzes Smartphone mit 6,5 Zoll.",
          "Es sollte schwarz sein und ein 6,5 Zoll Display haben.",
        ],
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
        variantQueries: [
          "Ich suche Smartphones im Preisbereich 200-400 Euro.",
          "Was kostet zwischen 200 und 400 €?",
        ],
        context: { activeCategorySlug: "elektronik" },
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K9",
        title: "Teuerstes Smartphone im Shop",
        query: "Welches ist das teuerste Smartphone, das du im Shop hast?",
        variantQueries: [
          "Was ist dein teuerstes Handy?",
          "Zeig mir bitte das Premium-Smartphone mit dem höchsten Preis.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "K10",
        title: "Mode – Slim Fit Jeans",
        query: "Ich suche eine blaue Slim Fit Jeans.",
        variantQueries: [
          "Hast du blaue Slim-Fit-Jeans?",
          "Zeig mir bitte eine Jeans in Blau, Slim Fit.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K11",
        title: "Mode – genau ein Produkt (keine Fallbacks)",
        query: "Zeig mir nur die Slim Fit Jeans Blau.",
        variantQueries: [
          "Ich möchte nur die blaue Slim-Fit-Jeans sehen.",
          "Zeig mir ausschließlich die Slim Fit Jeans in Blau.",
        ],
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
        variantQueries: [
          "Was ist deine billigste Jeans?",
          "Zeig mir bitte die preiswerteste Jeans.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K13",
        title: "Mode – unrealistisches Budget (unter 6 €)",
        query: "Hast du eine Jeans für unter 6 Euro?",
        variantQueries: [
          "Ich suche eine Jeans bis 6 €.",
          "Zeig mir bitte Jeans, maximal 6 Euro.",
        ],
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
        variantQueries: [
          "Hast du schwarze Jeans?",
          "Zeig mir bitte eine Jeans in Schwarz.",
        ],
        expected: {
          minCount: 1,
          categorySlug: "mode",
        },
      },
      {
        id: "K15",
        title: "Kontextwechsel Mode → Elektronik (explizit)",
        query: "Okay, zeig mir statt Jeans lieber ein Smartphone unter 300 Euro.",
        variantQueries: [
          "Lass uns das ändern: Ich möchte ein Handy bis 300 €.",
          "Stattdessen suche ich ein Smartphone, maximal 300 Euro.",
        ],
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
        variantQueries: [
          "Hast du das Alpha ULTRA PRO 1TB mit 7 Zoll?",
          "Zeig mir bitte das Smartphone Alpha ULTRA PRO 1TB 7 Zoll.",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
        },
      },
      {
        id: "K17",
        title: "Fake-Wasserkocher nicht im Katalog",
        query: "Hast du den Wasserkocher 'HyperBoil ZX-9000'?",
        variantQueries: [
          "Ich suche den HyperBoil ZX-9000 Wasserkocher.",
          "Zeig mir bitte den Wasserkocher HyperBoil ZX-9000.",
        ],
        expected: {
          minCount: 0,
          expectAiTrigger: true,
          categorySlug: "haushalt",
        },
      },

      // =========================================================
      // GRUPPE PROFI – Profiseller-Szenarien (Sales-Policy-Tests)
      // =========================================================
      {
        id: "PROFI-01",
        title: "Mehrdeutige Anfrage: Board",
        query: "Ich will ein Board.",
        variantQueries: [
          "Ich suche ein Board.",
          "Hast du Boards?",
        ],
        note: "Mehrdeutige Anfrage, Avatar soll nachfragen.",
        expected: {
          expectedPrimaryAction: "ASK_CLARIFICATION",
          expectedNotesIncludes: ["AMBIGUOUS_BOARD"],
        },
      },
      {
        id: "PROFI-02",
        title: "Low-Budget: Günstigstes Snowboard",
        query: "Zeig mir das günstigste Snowboard.",
        variantQueries: [
          "Was ist dein billigstes Snowboard?",
          "Zeig mir bitte das preiswerteste Board.",
        ],
        note: "Low-Budget-Anfrage, Avatar soll günstig + Upsell denken.",
        expected: {
          expectedPrimaryAction: "SHOW_PRODUCTS",
          expectedNotesIncludes: ["LOW_BUDGET_WITH_UPSELL"],
        },
      },
      {
        id: "PROFI-03",
        title: "Kauf-Intent: Cross-Selling",
        query: "Ich kaufe das Snowboard, was brauche ich noch dazu?",
        variantQueries: [
          "Wenn ich dieses Snowboard nehme, was sollte ich zusätzlich dazukaufen?",
          "Gibt es Zubehör, das du mir zu diesem Board empfehlen würdest?",
        ],
        note: "Kauf-Intent, Avatar soll Cross-Selling andeuten.",
        expected: {
          expectedPrimaryAction: "OFFER_CROSS_SELL",
          expectedNotesIncludes: ["BUY_INTENT_CROSS_SELL_HINT"],
        },
      },
      {
        id: "PROFI-04",
        title: "Lieferzeit-Frage",
        query: "Ist das morgen da, wenn ich heute bestelle?",
        variantQueries: [
          "Wie schnell kommt das an, wenn ich jetzt bestelle?",
          "Kann das bis morgen geliefert werden?",
        ],
        note: "Lieferzeit-Frage, Avatar soll Lieferinfo-Modus wählen.",
        expected: {
          expectedPrimaryAction: "SHOW_DELIVERY_INFO",
          expectedNotesIncludes: ["DELIVERY_QUESTION"],
        },
      },
      {
        id: "PROFI-05",
        title: "Rückgabe/Garantie-Frage",
        query: "Was ist, wenn es mir nicht passt?",
        variantQueries: [
          "Kann ich das zurückschicken, falls es nicht gefällt?",
          "Was passiert, wenn es mir nicht gefällt?",
        ],
        note: "Rückgabe/Garantie-Frage.",
        expected: {
          expectedPrimaryAction: "SHOW_RETURNS_INFO",
          expectedNotesIncludes: ["RETURNS_QUESTION"],
        },
      },
      {
        id: "PROFI-06",
        title: "Preis-Einwand",
        query: "Das ist mir zu teuer.",
        variantQueries: [
          "Der Preis ist mir zu hoch.",
          "Ich finde das zu teuer.",
        ],
        note: "Preis-Einwand, Avatar soll Einwand behandeln.",
        expected: {
          expectedPrimaryAction: "HANDLE_OBJECTION",
          expectedNotesIncludes: ["PRICE_OBJECTION"],
        },
      },
      {
        id: "PROFI-07",
        title: "Budget-Mismatch: Sehr niedriges Budget",
        query: "Ich suche ein komplettes Snowboard-Set unter 100 Euro.",
        variantQueries: [
          "Hast du Snowboard-Sets bis 100 €?",
          "Ich brauche ein komplettes Set, maximal 100 Euro.",
        ],
        note: "Sehr niedriges Budget, wahrscheinlich kein Treffer.",
        expected: {
          expectedPrimaryAction: "EXPLAIN_BUDGET_MISMATCH",
          expectedNotesIncludes: ["BUDGET_NO_MATCH"],
        },
      },
      {
        id: "PROFI-08",
        title: "Vage Anfrage: Nachfrage nötig",
        query: "Ich will was richtig Cooles für meinen Winterurlaub, aber ich weiß nicht genau was.",
        variantQueries: [
          "Ich brauche ein richtig cooles Board für den nächsten Trip.",
          "Hast du etwas, womit ich im Urlaub Eindruck mache?",
        ],
        note: "Vage, emotionale Anfrage, Avatar soll nachfragen.",
        expected: {
          expectedPrimaryAction: "ASK_CLARIFICATION",
          expectedNotesIncludes: ["NO_PRODUCTS_FOUND"],
        },
      },

      // =====================================================
      // Real-Life Demo Szenarien (RL01–RL40)
      // Zweck: Test echter Kundensprache für den 49er Demo-Katalog
      // =====================================================
      {
        id: "RL01",
        title: "Budget Snowboard normal",
        query: "Ich suche ein Snowboard für Anfänger, bitte nichts zu krasses. Budget so bis 300 Euro – was kannst du empfehlen?",
        note: "Budget-Snowboard für Anfänger, Budget bis 300 Euro - Review: Budget zu niedrig, zeigt trotzdem Produkte",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL02",
        title: "Premium Snowboard",
        query: "Hast du auch ein hochwertiges Snowboard für Fortgeschrittene? Preis ist mir egal, Hauptsache richtig gute Qualität.",
        note: "Premium-Snowboard, Preis egal",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL03",
        title: "Komplettes Snowboard-Set, Budget zu niedrig",
        query: "Kannst du mir ein komplettes Snowboard-Set mit Board und allem Zubehör zusammenstellen? Mehr als 200 Euro möchte ich aber ungern ausgeben.",
        note: "Komplettes Set, Budget zu niedrig (200 Euro) - Review: Budget zu niedrig, zeigt trotzdem Produkte, priceRangeNoMatch wird nicht immer gesetzt",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL04",
        title: "Wax-Verwirrung",
        query: "Ich habe gesehen, ihr habt was mit Wax. Ist das für die Haare oder für mein Snowboard? Ich will nur etwas zum Board-Wachsen.",
        note: "Wax-Verwirrung, klarstellen Snowboard-Wachs",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL05",
        title: "Smartphone mittleres Budget",
        query: "Ich brauche ein neues Smartphone für WhatsApp, ein paar Fotos und Video-Streaming. Budget: maximal 400 Euro. Was passt da am besten?",
        note: "Smartphone mittleres Budget (400 Euro)",
        expected: {
          minCount: 1,
          maxPrice: 400,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL06",
        title: "Smartphone + Zubehör (Cross-Sell)",
        query: "Zeig mir bitte ein gutes Smartphone und am besten gleich eine passende Hülle und ein Ladegerät dazu.",
        note: "Smartphone + Zubehör Cross-Sell",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL07",
        title: "Premium-Smartphone Kamera-Fokus",
        query: "Welches eurer Smartphones hat die beste Kamera? Preis ist zweitrangig, ich will vor allem richtig gute Fotos machen.",
        note: "Premium-Smartphone, Fokus auf Kamera",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL08",
        title: "Laptop fürs Homeoffice",
        query: "Ich brauche einen Laptop fürs Homeoffice, viel E-Mails, ein bisschen Excel, kein Gaming. Was empfiehlst du mir?",
        note: "Laptop für Homeoffice - Review: Kein Laptop im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL09",
        title: "Laptop + Zubehör (Maus/Headset)",
        query: "Gibt es zu dem Laptop auch sinnvolles Zubehör wie Maus oder Kopfhörer, das du mir empfehlen würdest?",
        note: "Laptop-Zubehör Cross-Sell - Review: Kein Laptop im Katalog, zeigt andere Produkte",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL10",
        title: "TV für kleines Wohnzimmer",
        query: "Ich suche einen Fernseher für ein kleines Wohnzimmer, darf nicht zu riesig sein. Budget ungefähr 600 Euro. Was hast du da?",
        note: "TV kleines Wohnzimmer, Budget 600 Euro",
        expected: {
          minCount: 1,
          maxPrice: 600,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL11",
        title: "Geschenk für Freund (Gaming/Tech)",
        query: "Ich brauche ein Geschenk für meinen Freund, der auf Gaming und Technik steht. Hast du da eine Idee?",
        note: "Geschenk Gaming/Tech - Review: Keine Gaming-Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL12",
        title: "Geschenk für Mama (Küche/Haushalt)",
        query: "Hast du etwas Schönes für meine Mutter, sie kocht gerne und mag praktische Sachen für die Küche?",
        note: "Geschenk Küche/Haushalt",
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "RL13",
        title: "Geschenk für Hundebesitzer",
        query: "Mein Bruder hat einen Hund und liebt seinen Vierbeiner. Was könntest du ihm beziehungsweise dem Hund als Geschenk empfehlen?",
        note: "Geschenk für Hundebesitzer",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL14",
        title: "Hundespielzeug vs. Futter",
        query: "Ich suche eher etwas zum Spielen für meinen Hund, nichts zum Fressen. Was hast du da?",
        note: "Hundespielzeug, kein Futter",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL15",
        title: "Duschgel empfindliche Haut",
        query: "Ich habe empfindliche Haut, kannst du mir ein mildes Duschgel empfehlen, das nicht zu stark riecht?",
        note: "Duschgel empfindliche Haut",
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "RL16",
        title: "Gesichtscreme Anti-Aging, höheres Budget",
        query: "Ich suche eine gute Gesichtscreme gegen Falten. Preis darf ruhig etwas höher sein, Hauptsache die Qualität stimmt.",
        note: "Gesichtscreme Anti-Aging, höheres Budget - Review: Intent wird nicht als premium erkannt",
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "RL17",
        title: "Parfüm, nicht zu süß",
        query: "Hast du ein Parfüm, das eher frisch und nicht so süß ist? Ich mag nichts Schweres.",
        note: "Parfüm frisch, nicht süß - Review: Keine passenden Parfüms im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL18",
        title: "Yoga-Matte + Home-Workout",
        query: "Ich möchte zu Hause mit Yoga anfangen. Kannst du mir eine Matte empfehlen und vielleicht noch etwas, was dazu passt?",
        note: "Yoga-Matte + Zubehör - Review: Keine Yoga-Matte im Katalog, zeigt andere Produkte",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL19",
        title: "Hanteln für Heimtraining",
        query: "Ich brauche Kurzhanteln für mein Home-Gym. Was kannst du mir für den Start empfehlen?",
        note: "Hanteln für Heimtraining - Review: Keine Hanteln im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL20",
        title: "Gartenlichter / Balkon-Atmosphäre",
        query: "Ich möchte meinen Balkon gemütlicher machen. Hast du Lichter oder Deko, die dafür passen?",
        note: "Gartenlichter / Balkon-Deko - Review: Keine passenden Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL21",
        title: "Indoor/Outdoor-Deko-Frage",
        query: "Sind eure Lichter eher für draußen oder drinnen gedacht? Ich will sie auf dem Balkon und vielleicht auch im Wohnzimmer nutzen.",
        note: "Indoor/Outdoor-Deko-Frage - Review: Keine passenden Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL22",
        title: "Büro-Set (Notizbuch + Stifte)",
        query: "Kannst du mir ein kleines Büro-Set zusammenstellen, zum Beispiel Notizbuch und Stifte für den Schreibtisch?",
        note: "Büro-Set Notizbuch + Stifte - Review: Keine Büro-Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL23",
        title: "Günstiger Homeoffice-Start",
        query: "Ich starte gerade ins Homeoffice und habe kaum Budget. Was ist das günstigste, womit ich erstmal vernünftig arbeiten kann?",
        note: "Günstiger Homeoffice-Start - Review: Keine Homeoffice-Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL24",
        title: "Budget-Smalltalk Badartikel",
        query: "Ich habe nicht so viel Geld, aber ich bräuchte irgendwas Kleines fürs Bad, vielleicht Duschgel oder so. Was schlägst du vor?",
        note: "Budget-Smalltalk Badartikel - Review: Zeigt Haushaltsprodukte statt Kosmetik",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL25",
        title: "Vage Lifestyle-Frage (Urlaub/Eindruck)",
        query: "Ich fahre bald in den Urlaub und möchte ein bisschen Eindruck machen. Hast du irgendetwas Cooles, das dazu passt?",
        note: "Vage Lifestyle-Frage Urlaub/Eindruck",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL26",
        title: "Rückgabe/Garantie",
        query: "Wie sieht es bei euch mit Rückgabe und Garantie aus, falls ich mit dem Produkt nicht zufrieden bin?",
        note: "Rückgabe/Garantie-Frage",
        expected: {
          expectedPrimaryAction: "SHOW_RETURNS_INFO",
          expectedNotesIncludes: ["RETURNS_QUESTION"],
        },
      },
      {
        id: "RL27",
        title: "Lieferzeit Deutschland",
        query: "Wenn ich heute bestelle, wann kommt meine Bestellung ungefähr bei mir in Deutschland an?",
        note: "Lieferzeit Deutschland",
        expected: {
          expectedPrimaryAction: "SHOW_DELIVERY_INFO",
          expectedNotesIncludes: ["DELIVERY_QUESTION"],
        },
      },
      {
        id: "RL28",
        title: "Versand ins Ausland (Österreich)",
        query: "Versendet ihr auch nach Österreich und wie lange dauert das ungefähr?",
        note: "Versand ins Ausland Österreich",
        expected: {
          expectedPrimaryAction: "SHOW_DELIVERY_INFO",
          expectedNotesIncludes: ["DELIVERY_QUESTION"],
        },
      },
      {
        id: "RL29",
        title: "Rabatt/Gutschein/Deal",
        query: "Gibt es aktuell irgendwelche Rabatte oder einen Gutschein, den ich nutzen kann? Wenn nicht, was wäre trotzdem ein gutes Preis-Leistungs-Angebot?",
        note: "Rabatt/Gutschein/Deal - Review: Keine passenden Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL30",
        title: "Günstigstes Produkt in einer Kategorie",
        query: "Was ist das günstigste Produkt, das du im Bereich Haushalt hast? Ich will wirklich so wenig wie möglich ausgeben.",
        note: "Günstigstes Produkt Haushalt",
        expected: {
          minCount: 1,
          expectIntent: "bargain",
          categorySlug: "haushalt",
        },
      },
      {
        id: "RL31",
        title: "Teuerstes/Premium-Produkt",
        query: "Zeig mir bitte euer hochwertigstes Produkt, egal in welcher Kategorie. Etwas, das sich wie ein Luxus-Geschenk anfühlt.",
        note: "Teuerstes/Premium-Produkt global",
        expected: {
          minCount: 1,
          expectIntent: "premium",
        },
      },
      {
        id: "RL32",
        title: "Englisch: Hundespielzeug",
        query: "Do you have something for my dog that is good for chewing and playing? Nothing with food, just a toy.",
        note: "Englisch: Hundespielzeug",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL33",
        title: "Englisch + Budget (Snowboard)",
        query: "I need a cheap snowboard for a total beginner, nothing too fast. Budget max 250 euros. What would you recommend?",
        note: "Englisch + Budget Snowboard - Review: Budget zu niedrig, zeigt trotzdem Produkte",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL34",
        title: "Preis-Einwand zu teuer",
        query: "Das sieht gut aus, aber das ist mir zu teuer. Hast du etwas Ähnliches, das günstiger ist?",
        note: "Preis-Einwand zu teuer",
        expected: {
          expectedPrimaryAction: "HANDLE_OBJECTION",
          expectedNotesIncludes: ["PRICE_OBJECTION"],
        },
      },
      {
        id: "RL35",
        title: "Vegan/Öko-Duschgel (potenziell nicht im Katalog)",
        query: "Hast du ein veganes oder besonders umweltfreundliches Duschgel? Wenn nicht, was wäre die beste Alternative?",
        note: "Vegan/Öko-Duschgel, potenziell nicht im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL36",
        title: "Umweltfreundliche Verpackung",
        query: "Achtet ihr bei euren Produkten oder beim Versand auf umweltfreundliche Verpackungen? Welches Produkt passt da am besten zu meinem Wunsch?",
        note: "Umweltfreundliche Verpackung",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL37",
        title: "Home-Gym-Set",
        query: "Kannst du mir ein kleines Set für mein Home-Gym zusammenstellen, zum Beispiel Matte und Hanteln oder etwas Ähnliches?",
        note: "Home-Gym-Set - Review: Keine Home-Gym-Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL38",
        title: "Erklärung Snowboards",
        query: "Kannst du mir bitte den Unterschied zwischen euren Snowboards erklären und sagen, welches zu mir passt, wenn ich eher Anfänger mit Ambitionen bin?",
        note: "Erklärung Snowboards, Anfänger mit Ambitionen",
        expected: {
          expectExplanationMode: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL39",
        title: "Alternative bei ausverkauft",
        query: "Wenn ein bestimmtes Produkt ausverkauft ist, kannst du mir dann eine sinnvolle Alternative vorschlagen? Zum Beispiel wenn mein Wunsch-Snowboard nicht mehr da ist.",
        note: "Alternative bei ausverkauft",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL40",
        title: "Geschenkgutschein",
        query: "Habt ihr Geschenkgutscheine, die ich kaufen kann, falls ich mir bei der Produktauswahl unsicher bin?",
        note: "Geschenkgutschein",
        expected: {
          minCount: 0,
        },
      },

      // =====================================================
      // Real-Life Varianten (RL01v1–RL20v2)
      // Verschärfte Tests für Profiseller-Verhalten
      // =====================================================
      {
        id: "RL01v1",
        title: "Budget Snowboard normal - Variante 1",
        query: "Kannst du mir bitte ein Snowboard für Anfänger empfehlen, so in etwa bis 300 Euro maximal?",
        note: "Budget-Anfrage, 'bis 300', freundliche Formulierung",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL01v2",
        title: "Budget Snowboard normal - Variante 2",
        query: "Ich will erstmal nur ein Einsteiger-Snowboard, echt nichts Teures, so um die 300 Euro. Was hast du da?",
        note: "Budget, sehr umgangssprachlich, weich formuliert",
        expected: {
          minCount: 1,
          expectNoMatchPriceRange: true,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL02v1",
        title: "Premium Snowboard - Variante 1",
        query: "Hast du auch ein richtig hochwertiges Snowboard? Es darf ruhig teuer sein, Hauptsache Top-Qualität.",
        note: "Premium-Snowboard, Preis egal",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL02v2",
        title: "Premium Snowboard - Variante 2",
        query: "Gib mir bitte dein bestes Snowboard, Preis ist egal, ich will einfach was richtig Gutes.",
        note: "Premium-Wunsch, explizit 'bestes' und 'Preis egal'",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL03v1",
        title: "Komplettes Snowboard-Set, Budget zu niedrig - Variante 1",
        query: "Ich brauche ein komplettes Snowboard-Set inklusive Bindung und allem drum und dran. Mehr als 250 Euro ist nicht drin.",
        note: "Komplett-Set + zu niedriges Budget",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL03v2",
        title: "Komplettes Snowboard-Set, Budget zu niedrig - Variante 2",
        query: "Kannst du mir alles fürs Snowboarden zusammenstellen, aber insgesamt maximal 200 Euro? Board, Bindung, alles dabei.",
        note: "Unrealistisches Gesamtbudget, Profi soll Budget-Mismatch erklären",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL04v1",
        title: "Wax-Verwirrung - Variante 1",
        query: "Dieses Wax bei euch, ist das für die Haare oder für mein Snowboard gedacht?",
        note: "Wax-Disambiguierung (Hair vs. Snowboard)",
        expected: {
          minCount: 1,
          categorySlug: "snowboard",
        },
      },
      {
        id: "RL04v2",
        title: "Wax-Verwirrung - Variante 2",
        query: "Ich brauche Wax für mein Board, kein Haarwachs. Was empfiehlst du mir dafür genau?",
        note: "Klar Snowboard-Wax, Fokus auf Explanation/Anwendung - Review: SellerBrain erkennt manchmal Kosmetik statt Snowboard",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL05v1",
        title: "Smartphone mittleres Budget - Variante 1",
        query: "Welches Smartphone passt für WhatsApp, Insta und ein paar Fotos, wenn ich höchstens 350 Euro ausgeben kann?",
        note: "Smartphone, Budget konkret, Alltags-Use-Case",
        expected: {
          minCount: 1,
          maxPrice: 350,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL05v2",
        title: "Smartphone mittleres Budget - Variante 2",
        query: "Ich suche ein Handy zum Chatten und Netflix schauen, maximal 400 Euro. Was würdest du mir empfehlen?",
        note: "Handy-Synonym, Streaming, klares Budget",
        expected: {
          minCount: 1,
          maxPrice: 400,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL06v1",
        title: "Smartphone + Zubehör (Cross-Sell) - Variante 1",
        query: "Zeig mir bitte ein gutes Smartphone und gleich eine passende Hülle dazu.",
        note: "Cross-Sell (Smartphone + Hülle)",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL06v2",
        title: "Smartphone + Zubehör (Cross-Sell) - Variante 2",
        query: "Ich brauche ein neues Handy mit Ladekabel und am besten direkt einer Schutzhülle. Was kannst du mir als Kombi vorschlagen?",
        note: "Handy + Ladegerät + Hülle, Cross-Sell",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL07v1",
        title: "Premium-Smartphone Kamera-Fokus - Variante 1",
        query: "Welches eurer Smartphones hat die beste Kamera, wenn ich viele Fotos und Reels mache?",
        note: "Kamera-Fokus, Content-Creator-Use-Case",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL07v2",
        title: "Premium-Smartphone Kamera-Fokus - Variante 2",
        query: "Ich will hauptsächlich gute Fotos von Familie und Urlaub machen. Welches Smartphone ist dafür euer bestes?",
        note: "Kamera-Qualität, Alltagssprache",
        expected: {
          minCount: 1,
          expectIntent: "premium",
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL08v1",
        title: "Laptop fürs Homeoffice - Variante 1",
        query: "Hast du einen Laptop, der sich gut fürs Homeoffice eignet – viel E-Mail, Meetings, bisschen Excel, kein Gaming?",
        note: "Laptop Homeoffice, klarer Use-Case, kein Gaming",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL08v2",
        title: "Laptop fürs Homeoffice - Variante 2",
        query: "Ich brauche einen Arbeits-Laptop für zu Hause, Office, Videocalls, nichts Ausgefallenes. Was ist da dein Favorit?",
        note: "Business-Use-Case, Beratungston",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL09v1",
        title: "Laptop + Zubehör (Maus/Headset) - Variante 1",
        query: "Zu dem Laptop hätte ich gerne auch eine Maus, was passt da gut zusammen?",
        note: "Cross-Sell: Laptop + Maus - Review: Kein Laptop im Katalog, keine passenden Produkte",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL09v2",
        title: "Laptop + Zubehör (Maus/Headset) - Variante 2",
        query: "Gibt es Kopfhörer, die du zu diesem Laptop empfehlen würdest, damit ich in Ruhe arbeiten kann?",
        note: "Cross-Sell: Laptop + Kopfhörer, Fokus 'ruhig arbeiten'",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL10v1",
        title: "TV für kleines Wohnzimmer - Variante 1",
        query: "Welcher Fernseher eignet sich für ein kleines Wohnzimmer, ohne dass er die ganze Wand einnimmt?",
        note: "TV-Größe, Raumgröße",
        expected: {
          minCount: 1,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL10v2",
        title: "TV für kleines Wohnzimmer - Variante 2",
        query: "Ich will einen nicht zu großen TV, so mittelgroß für mein Wohnzimmer, maximal 700 Euro. Was passt?",
        note: "TV + Budget, 'mittelgroß'",
        expected: {
          minCount: 1,
          maxPrice: 700,
          categorySlug: "elektronik",
        },
      },
      {
        id: "RL11v1",
        title: "Geschenk für Freund (Gaming/Tech) - Variante 1",
        query: "Mein Freund zockt gerne auf Konsole und PC. Hast du ein technisches Geschenk, das dazu passt?",
        note: "Geschenk für Gamer, Tech-Affinität",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL11v2",
        title: "Geschenk für Freund (Gaming/Tech) - Variante 2",
        query: "Ich brauche ein Geschenk für einen Technik-Freak – irgendwas Cooles aus der Elektronik-Ecke. Was schlägst du vor?",
        note: "Geschenk, Kategorie Elektronik, vage Wunsch",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL12v1",
        title: "Geschenk für Mama (Küche/Haushalt) - Variante 1",
        query: "Meine Mutter liebt es, in der Küche zu experimentieren. Hast du etwas Praktisches oder Hochwertiges für die Küche?",
        note: "Geschenk für Mutter, Küche/Haushalt",
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "RL12v2",
        title: "Geschenk für Mama (Küche/Haushalt) - Variante 2",
        query: "Kannst du mir ein Küchen-Gadget empfehlen, das man gut verschenken kann? Es soll nützlich sein und hochwertig wirken.",
        note: "Haushalts-/Küchenartikel, Geschenk-Use-Case",
        expected: {
          minCount: 1,
          categorySlug: "haushalt",
        },
      },
      {
        id: "RL13v1",
        title: "Geschenk für Hundebesitzer - Variante 1",
        query: "Mein Bruder ist total vernarrt in seinen Hund. Was wäre ein schönes Geschenk aus eurer Haustier-Ecke?",
        note: "Geschenk für Hundebesitzer, Haustier-Kategorie",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL13v2",
        title: "Geschenk für Hundebesitzer - Variante 2",
        query: "Ich suche ein Geschenk, das sowohl dem Hund als auch dem Besitzer Spaß macht. Hast du da etwas?",
        note: "Doppel-Fokus Hund + Besitzer, Spaßfaktor",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL14v1",
        title: "Hundespielzeug vs. Futter - Variante 1",
        query: "Ich suche ein robustes Spielzeug für meinen Hund, nichts zum Fressen, eher zum Kauen und Rumtragen.",
        note: "Hundespielzeug, kein Futter",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL14v2",
        title: "Hundespielzeug vs. Futter - Variante 2",
        query: "Bitte nur Spielzeug für den Hund zeigen, kein Futter und keine Pflegeprodukte.",
        note: "Klarer Ausschluss (Futter/Pflege), Filter-Logik",
        expected: {
          minCount: 1,
          categorySlug: "haustier",
        },
      },
      {
        id: "RL15v1",
        title: "Duschgel empfindliche Haut - Variante 1",
        query: "Gibt es bei euch ein Duschgel, das besonders mild ist? Meine Haut reagiert schnell empfindlich.",
        note: "empfindliche Haut, Duschgel mild",
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "RL15v2",
        title: "Duschgel empfindliche Haut - Variante 2",
        query: "Ich brauche ein sanftes Duschgel ohne extremen Duft. Was wäre da deine Empfehlung?",
        note: "Duft nicht zu stark, mild - Review: SellerBrain erkennt manchmal Parfüm statt Kosmetik",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL16v1",
        title: "Gesichtscreme Anti-Aging, höheres Budget - Variante 1",
        query: "Welche Gesichtscreme empfiehlst du gegen Falten, wenn ich bereit bin, etwas mehr dafür zu bezahlen?",
        note: "Anti-Aging, höheres Budget",
        expected: {
          minCount: 1,
          categorySlug: "kosmetik",
        },
      },
      {
        id: "RL16v2",
        title: "Gesichtscreme Anti-Aging, höheres Budget - Variante 2",
        query: "Ich will eine hochwertige Anti-Aging-Creme. Sie darf ruhig teuer sein, aber auch wirklich etwas bringen.",
        note: "Premium, Wirksamkeit, Kosmetik - Review: Keine passenden Produkte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL17v1",
        title: "Parfüm, nicht zu süß - Variante 1",
        query: "Hast du ein Parfüm, das eher frisch und zitrisch ist und nicht so schwer wirkt?",
        note: "Duftprofil frisch/zitrisch, kein schwerer Duft",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL17v2",
        title: "Parfüm, nicht zu süß - Variante 2",
        query: "Ich mag keine süßen Düfte. Welches eurer Parfüms riecht eher sauber und leicht?",
        note: "Anti-süß, frisch/clean",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL18v1",
        title: "Yoga-Matte + Home-Workout - Variante 1",
        query: "Für Yoga zu Hause – welche Matte würdest du mir als Einstieg empfehlen?",
        note: "Yoga-Matte für Einsteiger - Review: Keine Yoga-Matte im Katalog",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL18v2",
        title: "Yoga-Matte + Home-Workout - Variante 2",
        query: "Ich will mit Yoga anfangen und brauche eine Matte, die nicht rutscht. Was passt dafür?",
        note: "Anti-Rutsch, Yoga",
        expected: {
          minCount: 1,
        },
      },
      {
        id: "RL19v1",
        title: "Hanteln für Heimtraining - Variante 1",
        query: "Welche Hanteln eignen sich für den Einstieg ins Krafttraining zu Hause?",
        note: "Hanteln für Anfänger, Heimtraining",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL19v2",
        title: "Hanteln für Heimtraining - Variante 2",
        query: "Ich möchte zu Hause ein bisschen Muskeln aufbauen. Welche Kurzhanteln empfiehlst du mir?",
        note: "Home-Gym, Muskelaufbau",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL20v1",
        title: "Gartenlichter / Balkon-Atmosphäre - Variante 1",
        query: "Ich will meinen Balkon gemütlich machen – Lichterkette, vielleicht etwas Deko. Was kannst du da zeigen?",
        note: "Balkon-Deko, Beleuchtung + Deko",
        expected: {
          minCount: 0,
        },
      },
      {
        id: "RL20v2",
        title: "Gartenlichter / Balkon-Atmosphäre - Variante 2",
        query: "Hast du Deko oder Lichter, die draußen auf dem Balkon gut aussehen und auch ein bisschen wetterfest sind?",
        note: "Outdoor-Fokus, Garten/Balkon, Atmosphäre",
        expected: {
          minCount: 0,
        },
      },
    ];

    // Expandiere Basis-Szenarien mit Varianten
    const expandedTests: ScenarioTest[] = [];
    for (const base of baseTests) {
      // 1) Basisszenario immer mitnehmen
      expandedTests.push(base);

      // 2) Optionale Varianten erzeugen (falls vorhanden)
      if (base.variantQueries && base.variantQueries.length > 0) {
        let variantIndex = 1;

        for (const q of base.variantQueries) {
          const idSuffix = `v${variantIndex}`;
          expandedTests.push({
            ...base,
            id: `${base.id}${idSuffix}`,
            query: q,
            // keine rekursive Verschachtelung:
            variantQueries: undefined,
            note: base.note
              ? `${base.note} [Variant ${variantIndex}]`
              : `Variant ${variantIndex} of ${base.id}`,
          });
          variantIndex++;
        }
      }
    }

    const tests = expandedTests;

    const results: Array<{
      test: ScenarioTest;
      passed: boolean;
      details: string;
    }> = [];

    for (const test of tests) {
      console.log(`\n[${test.id}] ${test.title}`);
      console.log(`Query: "${test.query}"`);

      // Basisfall (wie bisher)
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

      // NEU: Varianten des Szenarios ausführen (falls vorhanden)
      if (test.variants && test.variants.length > 0) {
        for (let i = 0; i < test.variants.length; i++) {
          const variant = test.variants[i];
          const variantId = `${test.id}#v${i + 1}`;

          // Abgeleitetes Szenario-Objekt für die Variante:
          const variantScenario: ScenarioTest = {
            ...test,
            id: variantId,
            query: variant.query,
            note: variant.note ?? test.note,
          };

          console.log(`\n[${variantScenario.id}] ${variantScenario.title}`);
          console.log(`Query: "${variantScenario.query}"`);

          const variantEvaluation = await runScenarioTest(
            variantScenario,
            products,
            variantScenario.context
          );

          const variantStatus = variantEvaluation.passed ? "PASS" : "FAIL";
          console.log(`${variantScenario.id} ${variantStatus} - ${variantScenario.title}`);
          console.log(`  ${variantEvaluation.details}`);

          results.push({
            test: variantScenario,
            passed: variantEvaluation.passed,
            details: variantEvaluation.details,
          });
        }
      }
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
