/**
 * EFRO SellerBrain Budget-Test-Script
 * 
 * Testet die Budget- und Kategorie-Logik von runSellerBrain
 * OHNE Browser, OHNE ElevenLabs, nur SellerBrain-Engine.
 * 
 * Ausführung: pnpm sellerbrain:test
 */

import { runSellerBrain, SellerBrainResult, type SellerBrainContext } from "../src/lib/sales/sellerBrain";
import { type EfroProduct, type ShoppingIntent } from "../src/lib/products/mockCatalog";

/**
 * Lädt Test-Produkte von der EFRO Debug-API
 * EFRO Testkatalog-Fix 2025-11-30: Direkter Fetch von /api/efro/debug-products, kein Fallback
 */
async function loadTestProducts(): Promise<EfroProduct[]> {
  const DEBUG_PRODUCTS_URL =
    process.env.EFRO_DEBUG_PRODUCTS_URL ??
    "http://localhost:3000/api/efro/debug-products?shop=local-dev";

  console.log("[EFRO Test] Fetching products from", DEBUG_PRODUCTS_URL);

  let res: Response;
  try {
    res = await fetch(DEBUG_PRODUCTS_URL);
  } catch (err) {
    console.error("[EFRO Test] ERROR: Could not fetch from EFRO debug API.");
    console.error(err);
    process.exit(1);
  }

  if (!res.ok) {
    console.error("[EFRO Test] ERROR: API returned non-ok status", {
      status: res.status,
      statusText: res.statusText,
    });
    process.exit(1);
  }

  let productsJson: any;
  try {
    productsJson = await res.json();
  } catch (err) {
    console.error("[EFRO Test] ERROR: Could not parse JSON from EFRO debug API.");
    console.error(err);
    process.exit(1);
  }

  const products: EfroProduct[] = productsJson.products ?? [];

  if (!products.length) {
    console.error("[EFRO Test] ERROR: Kein Produkt aus EFRO debug API geladen.");
    process.exit(1);
  }

  console.log("[EFRO Test] Loaded products from EFRO debug API", {
    count: products.length,
  });

  return products;
}

/**
 * Führt einen einzelnen Testfall aus
 */
async function runTestCase(
  label: string,
  text: string,
  products: EfroProduct[]
) {
  console.log("\n================ " + label + " ================");
  console.log("userText:", text);

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

  // runSellerBrain aufrufen (exakt wie in page.tsx)
  const result: SellerBrainResult = await runSellerBrain(
    text,
    initialIntent,
    products,
    plan,
    previousRecommended,
    sellerContext
  );

  // EFRO Budget-Fix 2025-11-30: Erweiterte Auswertung mit Budget-Info
  console.log("\n→ replyText:");
  console.log(result.replyText);
  
  // Budget-Info aus dem Log extrahieren (wird in extractUserPriceRange geloggt)
  // Für Testzwecke: Wir können die Budget-Info aus priceRangeInfo ableiten
  if (result.priceRangeInfo) {
    const { userMinPrice, userMaxPrice } = result.priceRangeInfo;
    console.log("\n→ Budget-Parsing:");
    console.log(`   minPrice: ${userMinPrice ?? "null"}`);
    console.log(`   maxPrice: ${userMaxPrice ?? "null"}`);
  }
  
  console.log("\n→ priceRangeNoMatch:", result.priceRangeNoMatch ?? false);
  console.log("→ priceRangeInfo:", result.priceRangeInfo ?? undefined);
  console.log("→ missingCategoryHint:", result.missingCategoryHint ?? undefined);
  console.log("→ intent:", result.intent);
  console.log("→ plan:", plan);
  
  const recs = result.recommended ?? [];
  console.log("\n→ Recommended products (" + recs.length + "):");
  if (recs.length > 0) {
    recs.forEach((p, idx) => {
      console.log(`   ${idx + 1}. ${p.title} | ${p.price?.toFixed(2) ?? "n/a"} € | ${p.category ?? "n/a"}`);
    });
  } else {
    console.log("   (keine Produkte empfohlen)");
  }
  console.log("==================================================");
}

/**
 * Hauptfunktion
 */
async function main() {
  try {
    console.log("=== EFRO SellerBrain Budget- & Keyword-Test ===");
    console.log("EFRO Testkatalog-Fix 2025-11-30");
    console.log();
    
    // Produkte einmalig laden (sollte 60 sein, wenn Shopify-API verfügbar)
    const products = await loadTestProducts();
    console.log("[EFRO Test] Loaded products for local-dev", {
      count: products.length,
      sampleTitles: products.slice(0, 5).map(p => p.title),
    });
    console.log();

    // EFRO Budget-Fix 2025-11-30: Erweiterte Testfälle für Budget-Logik
    // TEST A: Untergrenze (unter/bis)
    await runTestCase(
      "TEST A: Snowboards unter 300 €",
      "Zeig mir Snowboards unter 300 Euro.",
      products
    );

    // TEST B: Über + OHNE Budget-Wort (minPrice)
    await runTestCase(
      "TEST B: Premium-Snowboard über 800 € (ohne Budget)",
      "Ich will ein Premium-Snowboard über 800 Euro.",
      products
    );

    // TEST C: Über + Budget-Wort (maxPrice)
    await runTestCase(
      "TEST C: Über meinem Budget",
      "800 Euro sind über meinem Budget.",
      products
    );

    // TEST D: Keine Zahl, nur Kategorie
    await runTestCase(
      "TEST D: Einsteiger Snowboard-Bindungen",
      "Ich suche etwas für Einsteiger im Bereich Snowboard-Bindungen.",
      products
    );

    console.log("\n✅ EFRO SellerBrain Testkatalog-Test fertig.");
  } catch (err) {
    console.error("❌ Fehler im SellerBrain-Test:", err);
    if (err instanceof Error) {
      console.error("Stack:", err.stack);
    }
    process.exit(1);
  }
}

main();

