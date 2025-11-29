// scripts/generateAliasMapFromAI.ts
//
// Hinweis:
// Dieses Skript ist in TypeScript geschrieben.
// Du kannst es z. B. mit tsx ausführen:
//   npx tsx scripts/generateAliasMapFromAI.ts
//
// (tsx ggf. als Dev-Dependency hinzufügen: npm install -D tsx)
//
// Dieses Script generiert eine Alias-Map für EFRO, die unbekannte Kundenbegriffe
// auf bekannte Katalog-Keywords abbildet. Die Alias-Map wird mit Hilfe einer AI
// generiert, die nur auf echte Tokens aus dem Katalog verweist.

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// TypeScript-Pfad-Auflösung für ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Typ-Definitionen
type AliasMap = Record<string, string[]>;

// Dynamischer Import für Next.js-Pfade
async function main() {
  // Dynamische Imports für TypeScript-Pfade
  const { mockCatalog } = await import("../src/lib/products/mockCatalog.js");
  
  // normalizeText ist nicht exportiert, daher lokale Implementierung (gleiche Logik wie sellerBrain)
  function normalizeText(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\s]/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // 1) Produkte laden
  const products = mockCatalog;

  console.log("[EFRO GenerateAliasMap] Lade Produkte...", {
    productCount: products.length,
  });

  // 2) Canonical Keywords aus Katalog extrahieren
  const canonicalKeywordsSet = new Set<string>();

  for (const product of products) {
    // Titel normalisieren und splitten
    const titleWords = normalizeText(product.title || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    titleWords.forEach((w) => canonicalKeywordsSet.add(w.toLowerCase().trim()));

    // Beschreibung normalisieren und splitten
    const descWords = normalizeText(product.description || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    descWords.forEach((w) => canonicalKeywordsSet.add(w.toLowerCase().trim()));

    // Kategorie normalisieren und splitten
    const categoryWords = normalizeText(product.category || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    categoryWords.forEach((w) => canonicalKeywordsSet.add(w.toLowerCase().trim()));

    // Tags normalisieren und splitten
    const rawTags = (product as any).tags;
    if (Array.isArray(rawTags)) {
      rawTags.forEach((tag: string) => {
        const tagWords = normalizeText(String(tag))
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        tagWords.forEach((w) => canonicalKeywordsSet.add(w.toLowerCase().trim()));
      });
    } else if (typeof rawTags === "string") {
      const tagWords = normalizeText(rawTags)
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      tagWords.forEach((w) => canonicalKeywordsSet.add(w.toLowerCase().trim()));
    }
  }

  const canonicalKeywords = Array.from(canonicalKeywordsSet).sort();

  console.log("[EFRO GenerateAliasMap] Canonical Keywords extrahiert", {
    keywordCount: canonicalKeywords.length,
    sample: canonicalKeywords.slice(0, 20),
  });

  // 3) Input-Begriffe (unknownTerms) - vorerst statisch konfiguriert
  // Später: kann aus Logs (z. B. [EFRO UnknownTerms]) eingesammelt werden
  const unknownTerms = [
    "fressnapf",
    "futterstation",
    "wassernapf",
    // Weitere Begriffe können hier hinzugefügt werden
  ];

  console.log("[EFRO GenerateAliasMap] Input-Begriffe", {
    unknownTerms,
  });

  // 4) Prompt für AI vorbereiten
  const prompt = buildAliasPrompt(canonicalKeywords, unknownTerms);

  console.log("[EFRO GenerateAliasMap] AI-Prompt generiert", {
    promptLength: prompt.length,
  });

  // 5) TODO: Hier würde der eigentliche AI-Call stattfinden
  // Beispiel-Struktur für später:
  // const aiResponse = await callOpenAIAPI(prompt);
  // const aliasMap = parseAIResponse(aiResponse);

  // Für jetzt: Dummy-Alias-Map (später durch AI-Response ersetzt)
  const aliasMap: AliasMap = {
    fressnapf: ["napfset", "näpfe"],
    futterstation: ["napfset"],
    wassernapf: ["napfset", "näpfe"],
  };

  // Filtere Alias-Map: Nur Ziel-Tokens, die wirklich in canonicalKeywords vorkommen
  const filteredAliasMap: AliasMap = {};
  const canonicalSet = new Set(canonicalKeywords);

  for (const [key, values] of Object.entries(aliasMap)) {
    const validValues = values.filter((v) => {
      const normalized = normalizeText(v).toLowerCase().trim();
      return canonicalSet.has(normalized);
    });

    if (validValues.length > 0) {
      filteredAliasMap[key] = validValues;
    }
  }

  console.log("[EFRO GenerateAliasMap] Alias-Map gefiltert", {
    originalEntries: Object.keys(aliasMap).length,
    filteredEntries: Object.keys(filteredAliasMap).length,
    filteredAliasMap,
  });

  // 6) Als JSON-Datei speichern
  const outputPath = join(__dirname, "../src/lib/sales/generatedAliasMap.json");
  const jsonContent = JSON.stringify(filteredAliasMap, null, 2);

  writeFileSync(outputPath, jsonContent, "utf-8");

  console.log("[EFRO GenerateAliasMap]", {
    canonicalKeywordsCount: canonicalKeywords.length,
    unknownTermsCount: unknownTerms.length,
    aliasMapEntries: Object.keys(filteredAliasMap).length,
    outputPath,
  });

  console.log(`\n✅ Alias-Map erfolgreich gespeichert: ${outputPath}`);
  console.log(`\n📝 Hinweis: Aktuell wird eine Dummy-Alias-Map verwendet.`);
  console.log(`   Um die AI-Integration zu aktivieren, ersetze den Dummy-Code`);
  console.log(`   durch einen echten AI-API-Call (z. B. OpenAI, Anthropic, etc.).`);
}

/**
 * Baut den Prompt-Text für die AI, um Alias-Mappings zu generieren.
 * 
 * @param canonicalKeywords Liste von echten Katalog-Tokens
 * @param unknownTerms Liste von unbekannten Kundenbegriffen
 * @returns Prompt-Text für die AI
 */
function buildAliasPrompt(
  canonicalKeywords: string[],
  unknownTerms: string[]
): string {
  return `Du bist eine Mapping-KI für einen Onlineshop.

Du bekommst:
- Eine Liste von KATALOG-TOKENS (canonicalKeywords). Diese Wörter und Phrasen kommen wirklich im Shop vor (Titel, Beschreibung, Kategorien, Tags).
- Eine Liste von KUNDENBEGRIFFEN (unknownTerms), die nicht direkt im Katalog vorkommen.

Aufgabe:
- Ordne jeden Kundenbegriff einer Liste von passenden KATALOG-TOKENS zu.
- Verwende ausschließlich Tokens aus der KATALOG-LISTE.
- Erfinde keine neuen Wörter, keine Synonyme außerhalb der Liste.
- Bevorzuge Tokens, die:
  - denselben Produktkontext haben (z. B. Haustier, Hund, Futter, Napf),
  - Set- oder Pluralformen enthalten (z. B. "Napfset", "Näpfe"),
  - realistisch im Shop zu den Kundenbegriffen passen.

Beispiel:
- Kundenbegriff: "Fressnapf"
- Katalog-Tokens: ["hunde", "napfset", "näpfe", "edelstahl", "silikonunterlage", "haustier", ...]
- GUTES Mapping: "fressnapf": ["napfset", "näpfe"]
- SCHLECHTES Mapping: "fressnapf": ["napf", "futternapf"]  (weil diese Wörter nicht in der Katalog-Liste stehen).

Ausgabeformat:
Gib ausschließlich ein JSON-Objekt im Format:

{
  "fressnapf": ["napfset", "näpfe"],
  "futterstation": ["napfset"],
  "wassernapf": ["napfset", "näpfe"]
}

---

KATALOG-TOKENS (${canonicalKeywords.length} Stück):
${canonicalKeywords.slice(0, 500).join(", ")}
${canonicalKeywords.length > 500 ? `\n... und ${canonicalKeywords.length - 500} weitere` : ""}

---

KUNDENBEGRIFFE (${unknownTerms.length} Stück):
${unknownTerms.join(", ")}

---

Gib jetzt das JSON-Objekt mit den Mappings zurück:`;
}

main().catch((err) => {
  console.error("[EFRO GenerateAliasMap ERROR]", err);
  process.exit(1);
});

