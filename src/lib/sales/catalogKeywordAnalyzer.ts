// src/lib/sales/catalogKeywordAnalyzer.ts

import type { EfroProduct } from "@/lib/products/mockCatalog";

/**
 * Statistik für ein einzelnes Keyword
 */
export type KeywordStat = {
  word: string;
  count: number;
  inTitle: boolean;
  inDescription: boolean;
  inTags: boolean;
  inCategory: boolean;
};

/**
 * Gesamtstatistik für alle Keywords im Katalog
 */
export type CatalogKeywordStats = {
  totalProducts: number;
  keywords: KeywordStat[];
};

/**
 * Stoppwörter, die bei der Keyword-Analyse ignoriert werden
 */
const STOPWORDS = [
  "und",
  "oder",
  "für",
  "mit",
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einen",
  "ist",
  "im",
  "in",
  "auf",
  "dem",
  "den",
  "zu",
  "von",
  "auch",
  "ohne",
  "an",
  "am",
  "es",
  "soll",
  "etwas",
  "ich",
  "du",
  "wir",
];

/**
 * Normalisiert Text für die Keyword-Analyse:
 * - Kleinschreibung
 * - Umlaute bleiben erhalten (ä, ö, ü, ß)
 * - Sonderzeichen entfernen
 * - Zahlen entfernen
 * - Mehrfach-Leerzeichen normalisieren
 */
function normalizeForAnalysis(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\d+/g, " ") // Zahlen entfernen
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrahiert Wörter aus einem normalisierten Text
 */
function extractWords(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((word) => word.length >= 2) // Mindestens 2 Zeichen
    .filter((word) => !STOPWORDS.includes(word));
}

/**
 * Analysiert den Produktkatalog und extrahiert die wichtigsten Keywords
 *
 * @param products Array von EfroProduct
 * @returns CatalogKeywordStats mit aggregierten Keyword-Statistiken
 */
export function analyzeCatalogKeywords(
  products: EfroProduct[]
): CatalogKeywordStats {
  // Map: word -> KeywordStat
  const keywordMap = new Map<string, KeywordStat>();

  // Durch alle Produkte iterieren
  for (const product of products) {
    // Titel normalisieren
    const normalizedTitle = normalizeForAnalysis(product.title || "");
    const titleWords = extractWords(normalizedTitle);

    // Beschreibung normalisieren
    const normalizedDescription = normalizeForAnalysis(
      product.description || ""
    );
    const descriptionWords = extractWords(normalizedDescription);

    // Tags normalisieren (Array oder String)
    let tagsText = "";
    const rawTags = (product as any).tags;
    if (Array.isArray(rawTags)) {
      tagsText = rawTags.map((tag) => String(tag)).join(" ");
    } else if (typeof rawTags === "string") {
      tagsText = rawTags;
    }
    const normalizedTags = normalizeForAnalysis(tagsText);
    const tagsWords = extractWords(normalizedTags);

    // Kategorie normalisieren
    const normalizedCategory = normalizeForAnalysis(product.category || "");
    const categoryWords = extractWords(normalizedCategory);

    // Alle Wörter sammeln (Set für eindeutige Wörter pro Produkt)
    const allWords = new Set<string>([
      ...titleWords,
      ...descriptionWords,
      ...tagsWords,
      ...categoryWords,
    ]);

    // Für jedes Wort die Statistik aktualisieren
    for (const word of allWords) {
      if (!keywordMap.has(word)) {
        keywordMap.set(word, {
          word,
          count: 0,
          inTitle: false,
          inDescription: false,
          inTags: false,
          inCategory: false,
        });
      }

      const stat = keywordMap.get(word)!;
      stat.count += 1;

      // Flags setzen, falls das Wort in diesem Produkt in den jeweiligen Feldern vorkommt
      if (titleWords.includes(word)) {
        stat.inTitle = true;
      }
      if (descriptionWords.includes(word)) {
        stat.inDescription = true;
      }
      if (tagsWords.includes(word)) {
        stat.inTags = true;
      }
      if (categoryWords.includes(word)) {
        stat.inCategory = true;
      }
    }
  }

  // Map in Array konvertieren und nach Häufigkeit sortieren
  const keywords = Array.from(keywordMap.values()).sort(
    (a, b) => b.count - a.count
  );

  return {
    totalProducts: products.length,
    keywords,
  };
}














