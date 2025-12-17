/**
 * EFRO Language Rules - Types
 * 
 * Definiert die Typen für statische und dynamische Sprachregeln
 */

/**
 * LanguageRule: Einheitlicher Typ für statische und dynamische Sprachregeln
 */
export type LanguageRule = {
  term: string;                // z. B. "fressnapf"
  locale: string;              // z. B. "de"
  canonical?: string;          // z. B. "napf"
  keywords?: string[];         // zusätzliche Synonyme / Schlüsselwörter
  categoryHints?: string[];    // optionale Kategorie-Hints (z. B. "pets", "dog", "cat", "accessories")
  source: "static" | "dynamic" | "ai";
};

/**
 * AI-Antwort für LanguageRule-Generierung
 */
export type LanguageRuleAiResponse = {
  canonical?: string;
  keywords?: string[];
  categoryHints?: string[];
};











