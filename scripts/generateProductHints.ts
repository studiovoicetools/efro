// scripts/generateProductHints.ts
//
// Hinweis:
// Dieses Skript ist in TypeScript geschrieben.
// Du kannst es z. B. mit tsx ausführen:
//   npx tsx scripts/generateProductHints.ts
//
// (tsx ggf. als Dev-Dependency hinzufügen: npm install -D tsx)
//
// Alternative: Mit ts-node (benötigt tsconfig-paths):
//   npx ts-node -r tsconfig-paths/register scripts/generateProductHints.ts

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// TypeScript-Pfad-Auflösung für ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Typ-Definition (importiert aus sellerBrain für Konsistenz)
import type { ProductHint } from "../src/lib/sales/sellerBrain.js";

// Dynamischer Import für Next.js-Pfade
// Da das Projekt "type": "module" verwendet, müssen wir mit ES-Imports arbeiten
async function main() {
  // Dynamische Imports für TypeScript-Pfade
  // Hinweis: .js-Endung ist notwendig für ES-Module, auch wenn die Datei .ts ist
  // tsx/ts-node löst die Pfade automatisch auf
  const { mockCatalog } = await import("../src/lib/products/mockCatalog.js");
  const { buildGeneratedHints } = await import("../src/lib/sales/keywordHintGenerator.js");
  const { productHints } = await import("../src/lib/sales/sellerBrain.js");

  // 1) Produkte laden
  const products = mockCatalog;

  console.log("[EFRO GenerateHints] Lade Produkte...", {
    productCount: products.length,
  });

  // 2) Generierte Keyword-Statistiken aufbauen
  const generatedHints = buildGeneratedHints(products, productHints);

  console.log("[EFRO GenerateHints] Generierte Hints erstellt", {
    hintCount: generatedHints.length,
  });

  // 3) GeneratedHint[] in ProductHint[] konvertieren
  const productHintsList: ProductHint[] = generatedHints.map((hint) => {
    // Einfache Heuristik für weight basierend auf count
    // weight = Math.min(5, 1 + Math.floor(Math.log10(count + 1)))
    // Oder einfacher: weight = count (für Demo)
    const weight = Math.min(5, 1 + Math.floor(Math.log10(hint.count + 1)));

    // Optional: categoryHint basierend auf inCategory
    const categoryHint =
      hint.inCategory > 0 ? "category" : undefined;

    // Optional: attributes basierend auf Vorkommen
    const attributes: string[] = [];
    if (hint.inTitle > 0) attributes.push("title");
    if (hint.inDescription > 0) attributes.push("description");
    if (hint.inTags > 0) attributes.push("tags");
    if (hint.inCategory > 0) attributes.push("category");

    return {
      keyword: hint.word,
      weight,
      categoryHint,
      attributes: attributes.length > 0 ? attributes : undefined,
    };
  });

  // 4) Als JSON-Datei speichern
  const outputPath = join(__dirname, "../src/lib/sales/generatedProductHints.json");
  const jsonContent = JSON.stringify(productHintsList, null, 2);

  writeFileSync(outputPath, jsonContent, "utf-8");

  console.log("[EFRO GeneratedHints]", {
    productCount: products.length,
    hintCount: productHintsList.length,
    outputPath,
    sample: productHintsList.slice(0, 20).map((h) => ({
      keyword: h.keyword,
      weight: h.weight,
      count: generatedHints.find((gh) => gh.word === h.keyword)?.count,
    })),
  });

  console.log(`\n✅ Generierte Hints erfolgreich gespeichert: ${outputPath}`);
}

main().catch((err) => {
  console.error("[EFRO GenerateHints ERROR]", err);
  process.exit(1);
});

