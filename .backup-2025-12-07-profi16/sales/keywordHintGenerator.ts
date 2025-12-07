// src/lib/sales/keywordHintGenerator.ts

import type { EfroProduct } from "@/lib/products/mockCatalog";
import { analyzeCatalogKeywords, type KeywordStat } from "./catalogKeywordAnalyzer";

/**
 * Generierter Hint-Eintrag basierend auf Keyword-Analyse
 */
export type GeneratedHint = {
  word: string;
  count: number; // Anzahl Produkte, in denen das Wort vorkommt
  inTitle: number; // Anzahl Produkte, in denen das Wort im Titel vorkommt
  inDescription: number; // Anzahl Produkte, in denen das Wort in der Beschreibung vorkommt
  inTags: number; // Anzahl Produkte, in denen das Wort in Tags vorkommt
  inCategory: number; // Anzahl Produkte, in denen das Wort in der Kategorie vorkommt
};

/**
 * Stoppwörter, die bei der Hint-Generierung ignoriert werden
 * (1:1 dupliziert aus catalogKeywordAnalyzer.ts, da dort nicht exportiert)
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
 * Baut eine Liste von generierten Hints aus dem Produktkatalog.
 * 
 * Filterlogik:
 * - Nur Wörter mit mindestens 3 Zeichen
 * - Keine Stopwörter
 * - Keine Wörter, die bereits in productHints (sellerBrain.ts) vorkommen
 * 
 * @param products Array von EfroProduct
 * @param existingHints Array von bereits vorhandenen Hints (z. B. aus sellerBrain.ts)
 * @returns Array von GeneratedHint, sortiert nach count (absteigend)
 */
export function buildGeneratedHints(
  products: EfroProduct[],
  existingHints: string[] = []
): GeneratedHint[] {
  // 1) Keyword-Analyse durchführen
  const stats = analyzeCatalogKeywords(products);

  // 2) Normalisierte Liste der bestehenden Hints erstellen (für Vergleich)
  const normalizedExistingHints = new Set(
    existingHints.map((hint) => hint.toLowerCase().trim())
  );

  // 3) Map für aggregierte Zählungen pro Wort
  const hintMap = new Map<string, GeneratedHint>();

  // 4) Durch alle Keywords iterieren und aggregieren
  for (const keywordStat of stats.keywords) {
    const word = keywordStat.word.toLowerCase().trim();

    // Filter: Mindestens 3 Zeichen
    if (word.length < 3) {
      continue;
    }

    // Filter: Keine Stopwörter
    if (STOPWORDS.includes(word)) {
      continue;
    }

    // Filter: Nicht bereits in bestehenden Hints
    if (normalizedExistingHints.has(word)) {
      continue;
    }

    // Initialisiere oder aktualisiere den Hint-Eintrag
    if (!hintMap.has(word)) {
      hintMap.set(word, {
        word,
        count: 0,
        inTitle: 0,
        inDescription: 0,
        inTags: 0,
        inCategory: 0,
      });
    }

    const hint = hintMap.get(word)!;

    // Aggregiere die Zählungen
    // Da analyzeCatalogKeywords boolean-Flags liefert, müssen wir
    // die tatsächlichen Vorkommen aus den Produkten zählen
    hint.count += keywordStat.count;

    // Für die Detail-Zählungen müssen wir durch die Produkte iterieren
    // und prüfen, in welchen Feldern das Wort vorkommt
    for (const product of products) {
      const normalizedTitle = (product.title || "").toLowerCase();
      const normalizedDescription = (product.description || "").toLowerCase();
      const normalizedCategory = (product.category || "").toLowerCase();

      // Tags normalisieren
      let tagsText = "";
      const rawTags = (product as any).tags;
      if (Array.isArray(rawTags)) {
        tagsText = rawTags.map((tag) => String(tag).toLowerCase()).join(" ");
      } else if (typeof rawTags === "string") {
        tagsText = rawTags.toLowerCase();
      }

      // Prüfe, ob das Wort in den jeweiligen Feldern vorkommt
      if (normalizedTitle.includes(word)) {
        hint.inTitle += 1;
      }
      if (normalizedDescription.includes(word)) {
        hint.inDescription += 1;
      }
      if (tagsText.includes(word)) {
        hint.inTags += 1;
      }
      if (normalizedCategory.includes(word)) {
        hint.inCategory += 1;
      }
    }
  }

  // 5) In Array konvertieren und nach count sortieren
  const hints = Array.from(hintMap.values());

  // Sortiere nach count (absteigend), dann alphabetisch
  hints.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.word.localeCompare(b.word);
  });

  return hints;
}

