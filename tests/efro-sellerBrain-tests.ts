// tests/efro-sellerBrain-tests.ts
/**
 * Minimale Test-Pipeline für runSellerBrain
 * 
 * Läuft ohne Next.js/Browser/ElevenLabs
 * 
 * Usage: pnpm test:efro
 */

import { runSellerBrain, type SellerBrainContext } from "../src/lib/sales/sellerBrain";
import { mockCatalog, type EfroProduct, type ShoppingIntent } from "../src/lib/products/mockCatalog";

type TestCase = {
  name: string;
  text: string;
};

const TEST_CASES: TestCase[] = [
  { name: "Snowboards Basis", text: "Ich suche Snowboards." },
  { name: "Snowboards Budget-Bereich", text: "Zeige mir Snowboards zwischen 900 und 1100 Euro." },
  { name: "Budget über 600 Euro (DE-Logik: Obergrenze)", text: "Ich habe ein Budget von über 600 Euro." },
  { name: "Parfüme / Düfte", text: "Ich suche Parfüme." },
  { name: "Marken-/Name-Suche Adabakowski", text: "Ich suche Adabakowski." },
  { name: "Alias / Fressnapf", text: "Zeige mir Fressnapf." },
];

/**
 * Baut den SellerContext auf, wie er im normalen EFRO-Flow verwendet wird
 */
function buildSellerContext(): SellerBrainContext {
  // Für Tests: Kein aktiver Kategorie-Kontext
  return {
    activeCategorySlug: null,
  };
}

/**
 * Lädt Produkte wie im normalen EFRO-Flow (Fallback auf mockCatalog)
 */
function loadProducts(): EfroProduct[] {
  // Verwende mockCatalog als Fallback (wie in page.tsx)
  const products = mockCatalog;
  
  console.log("[EFRO Test] Loaded products", {
    count: products.length,
    source: "mockCatalog",
    sample: products.slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
      price: p.price,
    })),
  });
  
  return products;
}

/**
 * Führt einen einzelnen Testfall aus
 */
async function runSingleTest(
  testCase: TestCase,
  products: EfroProduct[],
  context: SellerBrainContext
): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log(`🔎 Test: ${testCase.name}`);
  console.log(`💬 Text: ${testCase.text}`);
  console.log("=".repeat(60));

  try {
    // Rufe runSellerBrain auf, genau wie im normalen Flow
    const result = runSellerBrain(
      testCase.text,
      "explore", // currentIntent: Standard-Intent für Tests
      products,
      "starter", // plan: Standard-Plan für Tests
      undefined, // previousRecommended: Keine vorherigen Empfehlungen
      context // context: SellerBrainContext
    );

    // Extrahiere Budget-Informationen aus dem Text (für Anzeige)
    const budgetMatch = testCase.text.match(/(\d+)\s*(?:€|euro|eur)/i);
    const budgetInfo = budgetMatch
      ? ` (Budget: ${budgetMatch[1]} €)`
      : "";

    // Logge Ergebnisse
    console.log(`📦 Produkte gefunden: ${result.recommended?.length ?? 0}`);
    
    if (result.recommended && result.recommended.length > 0) {
      console.log("  Titel:");
      result.recommended.slice(0, 5).forEach((p, idx) => {
        const price = p.price != null ? `${p.price.toFixed(2)} €` : "–";
        console.log(`    ${idx + 1}. ${p.title} (${price})`);
      });
    }

    // Budget-Range (falls im Text vorhanden)
    if (budgetInfo) {
      console.log(`💰 Budget-Range: ${budgetInfo}`);
    }

    // Kategorie (falls vorhanden)
    if (result.nextContext?.activeCategorySlug) {
      console.log(`📂 Kategorie: ${result.nextContext.activeCategorySlug}`);
    }

    // ReplyText (gekürzt)
    const replyPreview = result.replyText
      ? result.replyText.substring(0, 200) + (result.replyText.length > 200 ? "..." : "")
      : "(kein ReplyText)";
    console.log(`🗣️  ReplyText (gekürzt): ${replyPreview}`);

    // AI-Trigger (falls vorhanden)
    if (result.aiTrigger?.needsAiHelp) {
      console.log(`⚠️  AI-Trigger: ${result.aiTrigger.reason || "unknown"}`);
      if (result.aiTrigger.unknownTerms && result.aiTrigger.unknownTerms.length > 0) {
        console.log(`   Unknown Terms: ${result.aiTrigger.unknownTerms.join(", ")}`);
      }
      if (result.aiTrigger.codeTerm) {
        console.log(`   Code Term: ${result.aiTrigger.codeTerm}`);
      }
    } else {
      console.log(`✅ Kein AI-Trigger`);
    }

    // Intent
    console.log(`🎯 Intent: ${result.intent}`);

    console.log("=".repeat(60));
  } catch (err) {
    console.error(`❌ Fehler im Test "${testCase.name}":`, err);
    if (err instanceof Error) {
      console.error("   Stack:", err.stack);
    }
    console.log("=".repeat(60));
  }
}

/**
 * Hauptfunktion: Führt alle Testfälle aus
 */
async function main(): Promise<void> {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     EFRO SellerBrain Test-Pipeline                       ║");
  console.log("║     Läuft ohne Next.js/Browser/ElevenLabs                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");

  // Lade Produkte (wie im normalen Flow)
  const products = loadProducts();

  // Baue Context auf
  const context = buildSellerContext();

  // Führe alle Testfälle aus
  for (const testCase of TEST_CASES) {
    await runSingleTest(testCase, products, context);
  }

  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║     Alle Tests abgeschlossen                             ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log("\n");
}

// Starte Tests
main().catch((err) => {
  console.error("\n❌ Unerwarteter Fehler im EFRO-Test:", err);
  if (err instanceof Error) {
    console.error("   Message:", err.message);
    console.error("   Stack:", err.stack);
  }
  process.exit(1);
});

