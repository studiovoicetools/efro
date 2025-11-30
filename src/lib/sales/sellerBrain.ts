// src/lib/sales/sellerBrain.ts

/**
 * ============================================================
 * ÄNDERUNGEN (Senior TypeScript/Next.js Engineer - Debug-Fix)
 * ============================================================
 * 
 * 1. Defensive Guard für leere allProducts in runSellerBrain() hinzugefügt
 *    → Früher Return mit Fallback-Text, wenn keine Produkte verfügbar
 * 
 * 2. Defensive Guard für leeren/undefined replyText am Ende von runSellerBrain()
 *    → Sicherstellt, dass IMMER ein gültiger String zurückgegeben wird
 * 
 * 3. Frontend-Integration verbessert (src/app/avatar-seller/page.tsx)
 *    → Prüfung auf nicht-leeren String statt nur truthy-Check
 *    → Fallback-Nachricht, wenn replyText leer ist
 * 
 * 4. JSON-Imports verifiziert (tsconfig.json hat resolveJsonModule: true)
 *    → generatedProductHints.json und generatedAliasMap.json funktionieren korrekt
 * 
 * 5. Tags-Behandlung bereits defensiv implementiert
 *    → isPerfumeProduct() und isMoldProduct() behandeln tags als Array oder String
 * 
 * 6. buildAttributeIndex() wird sicher mit Array aufgerufen
 *    → Guard in filterProducts() prüft allProducts.length === 0
 * 
 * 7. buildRuleBasedReplyText() gibt IMMER einen String zurück
 *    → Auch bei count === 0 gibt es einen Fallback-Text
 * 
 * 8. Logging erweitert für besseres Debugging
 *    → Warn-Logs bei leeren Produktlisten oder replyText
 *    → replyTextLength in [EFRO SB RETURN] Log
 * 
 * 9. Keine Änderungen an API-Signaturen
 *    → runSellerBrain() und SellerBrainResult bleiben unverändert
 * 
 * 10. Keine Änderungen an Avatar/LipSync-Code
 *     → Nur sellerBrain.ts und Frontend-Integration angepasst
 * 
 * ============================================================
 * ARCHITEKTUR-ÜBERSICHT: FILTER-PIPELINE IN filterProducts()
 * ============================================================
 * 
 * Reihenfolge der Filter in filterProducts(text, intent, allProducts):
 * 
 * 1. ENTER: Initialisierung
 *    - candidates = [...allProducts] (Start: alle Produkte)
 *    - Intent kann innerhalb der Funktion angepasst werden (currentIntent)
 * 
 * 2. PRICE: Preisbereich extrahieren
 *    - extractUserPriceRange(text) → userMinPrice, userMaxPrice
 *    - Wird später angewendet (nach KEYWORD_MATCHES)
 * 
 * 3. CATEGORY: Kategorie-Filter
 *    - matchedCategories aus Text extrahieren
 *    - candidates = candidates.filter(p => matchedCategories.includes(p.category))
 * 
 * 4. WORDS: Keyword-Extraktion
 *    - words aus Text extrahieren (Stopwörter entfernt)
 *    - catalogKeywords aus allen Produkten extrahieren
 *    - expandWordsWithCatalogKeywords() für Komposita-Aufbrechen
 * 
 * 5. ALIAS-PREPROCESSING: Alias-Map vor Keyword-Matching
 *    - resolveUnknownTerms() mit catalogKeywords
 *    - Wenn resolved.length > 0: words/expandedWords erweitern
 *    - AliasHardFilter: Bei aliasMapUsed === true nur Produkte mit Alias-Tokens
 * 
 * 6. KEYWORD_MATCHES: Scoring und Filterung
 *    - scoreProductsForWords() für alle Kandidaten
 *    - candidates = scored.filter(score > 0).sort().slice(0, 20)
 *    - PERFUME-SYNONYMS: Wenn userAskedForPerfume === true
 *      → candidates = perfumeCandidates (nur echte Parfüm-Produkte)
 * 
 * 7. PRICE-FILTER: Preisbereich anwenden
 *    - candidates = candidates.filter(price >= minPrice && price <= maxPrice)
 * 
 * 8. FALLBACK: Wenn candidates.length === 0
 *    - Bei Parfüm-Intent: originalPerfumeCandidates beibehalten
 *    - Sonst: candidates = [...allProducts] + Kategorie/Preis-Filter erneut
 * 
 * 9. SORTIERUNG: Nach Intent/Budget
 *    - Premium: teuerste zuerst
 *    - Bargain/Quick-Buy: günstigste zuerst
 *    - Budget: je nach Min/Max sortiert
 * 
 * 10. RESULT: return candidates.slice(0, 4)
 * 
 * WICHTIGE VARIABLEN:
 * - candidates: Haupt-Kandidatenliste (wird durch Filter verändert)
 * - currentIntent: Intent kann innerhalb der Funktion angepasst werden
 * - hasPerfumeCandidates: Flag für Parfüm-Intent (schützt vor Fallback-Überschreibung)
 * - originalPerfumeCandidates: Backup der Parfüm-Kandidaten für Fallback-Schutz
 * 
 * INTENT-ÄNDERUNGEN:
 * - explore → quick_buy: Bei "zeige mir X" mit 1-4 Wörtern (Zeile ~1595-1611)
 * 
 * ============================================================
 * 
 * TEST-CASES FÜR GESUNDHEITSCHECK:
 * ============================================================
 * 
 * Budget-Only:
 * - "Mein Budget ist 20 Euro."
 *   Erwartung: [EFRO FILTER PRICE] userMaxPrice: 20, UI zeigt Produkte ≤ 20€
 * 
 * - "Mein Budget ist 50 Euro."
 *   Erwartung: [EFRO FILTER PRICE] userMaxPrice: 50, UI zeigt Produkte ≤ 50€
 * 
 * Kategorie/Brand:
 * - "Zeige mir Fressnapf."
 *   Erwartung: [EFRO AliasHardFilter] reduziert Kandidaten, UI zeigt Fressnapf-Artikel
 * 
 * Parfüm:
 * - "Zeige mir Parfüm."
 * - "Zeig mir Parfum!"
 *   Erwartung:
 *     [EFRO PERFUME] afterCount = Anzahl echter Parfüm-Produkte
 *     [EFRO FINAL PRODUCTS] → nur Parfüm-Produkte (categories z. B. "perfume" / "duft")
 *     KEINE Duschgele/Shampoos/Lotions/Tücher
 * 
 * High-Budget:
 * - "Zeig mir Produkte über 350 Euro!"
 *   Erwartung: Nur teure Produkte (High-End) in FINAL/UI
 * 
 * Kombi:
 * - "Zeig mir Parfüm unter 50 Euro."
 *   Erwartung: Entweder echte Parfüms ≤ 50€ ODER klarer Fallback (keine Körperpflege-Nicht-Parfüms)
 * 
 * STATUS:
 * - Budget-Only: ✅ Funktioniert
 * - Fressnapf: ✅ Funktioniert (AliasHardFilter)
 * - Parfüm: 🔧 Wird repariert (zu breite Erkennung)
 * - High-Budget: ✅ Funktioniert
 * - Kombi: 🔧 Wird getestet nach Parfüm-Fix
 * 
 * ============================================================
 */

import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
// Import der generierten Hints aus JSON
// Hinweis: TypeScript erwartet hier einen Typ-Assertion, da JSON-Imports als any kommen
import generatedProductHintsJson from "./generatedProductHints.json";
// Import der Alias-Map für AI-gestützte Begriff-Auflösung
import type { AliasMap } from "./aliasMap";
import { normalizeAliasKey, initializeAliasMap } from "./aliasMap";
// Import der Sprach-Konfiguration für deutsche Budget- und Keyword-Erkennung
import {
  BUDGET_RANGE_PATTERNS,
  BUDGET_MIN_WORDS,
  BUDGET_MAX_WORDS,
  BUDGET_AROUND_WORDS,
  BUDGET_WORD_PATTERNS,
  RANGE_BUDGET_WORDS,
  CATEGORY_KEYWORDS,
  USAGE_KEYWORDS,
  SKIN_KEYWORDS,
  INTENT_WORDS,
  QUERY_STOPWORDS,
  ATTRIBUTE_PHRASES,
  ATTRIBUTE_KEYWORDS,
  PRODUCT_HINTS,
  NON_CODE_TERMS as NON_CODE_TERMS_ARRAY,
  UNKNOWN_AI_STOPWORDS as UNKNOWN_AI_STOPWORDS_ARRAY,
  SHOW_ME_PATTERNS,
  EXPLANATION_MODE_KEYWORDS,
  CORE_PRODUCT_KEYWORDS,
  PERFUME_SYNONYMS,
  PREMIUM_TOKENS,
  MOLD_KEYWORDS,
  MOLD_PRODUCT_KEYWORDS,
  CONTEXT_KEYWORDS,
  PREMIUM_WORDS,
  BARGAIN_WORDS,
  GIFT_WORDS,
  BUNDLE_WORDS,
  EXPLORE_WORDS,
  MOST_EXPENSIVE_PATTERNS,
  BUDGET_KEYWORDS_FOR_SCENARIO,
  CATEGORY_KEYWORDS_FOR_SCENARIO,
  PRODUCT_KEYWORDS_FOR_BUDGET_ONLY,
  BUDGET_ONLY_STOPWORDS,
} from "./languageRules.de";

/**
 * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
 */
export interface SellerBrainContext {
  activeCategorySlug?: string | null;
}

/**
 * AI-Trigger: Signal, wann SellerBrain zusätzliche AI-Hilfe gebrauchen könnte
 */
export interface SellerBrainAiTrigger {
  /** true, wenn SellerBrain zusätzliche AI-Hilfe gebrauchen könnte */
  needsAiHelp: boolean;
  /** Kurzbegründung, warum AI sinnvoll wäre */
  reason: string;
  /** Begriffe, die bisher nicht gut aufgelöst wurden */
  unknownTerms: string[];
  /** Erkannter Produktcode wie "ABC123" */
  codeTerm?: string;
}

/**
 * Ergebnisstruktur des Seller-Gehirns
 */
export type SellerBrainResult = {
  intent: ShoppingIntent;
  recommended: EfroProduct[];
  replyText: string;
  nextContext?: SellerBrainContext;
  /** Meta-Infos, wann eine AI-Hilfe sinnvoll wäre */
  aiTrigger?: SellerBrainAiTrigger;
};

type ExplanationMode = "ingredients" | "materials" | "usage" | "care" | "washing";

/**
 * Attribut-Map pro Produkt
 * z. B. { skin_type: ["dry", "sensitive"], audience: ["men"], room: ["bathroom"] }
 */
type ProductAttributeMap = Record<string, string[]>;

/**
 * Vokabular-Eintrag für ein Attribut auf Shop-Ebene
 */
type ShopAttributeVocabulary = {
  key: string;           // z. B. "skin_type", "audience", "room", "pet", "family"
  values: string[];      // z. B. ["dry", "sensitive", "oily"]
  examples: string[];    // Produkt-Titel-Beispiele (max. 3)
  usageCount: number;    // Anzahl Produkte, die dieses Attribut verwenden
};

/**
 * Vollständiger Attribut-Index für den Shop
 */
type AttributeIndex = {
  perProduct: Record<string, ProductAttributeMap>;  // Key = product.id
  vocabulary: ShopAttributeVocabulary[];
};

/**
 * Typ für Produkt-Hints (statisch oder generiert)
 */
export type ProductHint = {
  keyword: string;
  categoryHint?: string;
  attributes?: string[];
  weight?: number;
};

/**
 * Zentrale Text-Normalisierung (vereinheitlicht)
 * – Umlaute bleiben erhalten, damit Stopwords wie "für", "größer" etc. sauber matchen.
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kategorien, die typischerweise für menschliche Haut-/Kosmetik-Produkte verwendet werden
 */
const HUMAN_SKIN_CATEGORIES = [
  "kosmetik",
  "beauty",
  "pflege",
  "haut",
  "gesicht",
  "body",
];

/**
 * Nutzertext normalisieren (Legacy-Kompatibilität)
 */
function normalize(text: string): string {
  return normalizeText(text);
}

/**
 * Statische Produkt-Hints (manuell gepflegt)
 * Wird als string[] exportiert, um bestehenden Code nicht zu brechen.
 * Importiert aus languageRules.de.ts
 */
export const productHints: string[] = PRODUCT_HINTS;

/**
 * Typisierte Version der statischen Hints
 * Wird aus productHints generiert, um Kompatibilität zu gewährleisten.
 */
export const staticProductHints: ProductHint[] = productHints.map((keyword) => ({
  keyword,
  weight: 1,
}));

/**
 * Führt statische und generierte Hints zusammen.
 * 
 * Regeln:
 * - Statische Hints haben Priorität bei Duplikaten
 * - Wenn beide ein weight haben, wird das höhere verwendet
 * - Generierte Hints ohne Duplikate werden übernommen
 * 
 * @param staticHints Statische, manuell gepflegte Hints
 * @param generatedHints Optional: Dynamisch generierte Hints (z. B. aus JSON)
 * @returns Zusammengeführte Liste von ProductHint
 */
function mergeHints(
  staticHints: ProductHint[],
  generatedHints?: ProductHint[]
): ProductHint[] {
  // Wenn keine generierten Hints vorhanden, nur statische zurückgeben
  if (!generatedHints || generatedHints.length === 0) {
    return [...staticHints];
  }

  // Map für schnelles Lookup nach keyword
  const mergedMap = new Map<string, ProductHint>();

  // Zuerst alle statischen Hints einfügen (haben Priorität)
  for (const hint of staticHints) {
    mergedMap.set(hint.keyword.toLowerCase(), { ...hint });
  }

  // Dann generierte Hints hinzufügen, falls nicht bereits vorhanden
  for (const hint of generatedHints) {
    const key = hint.keyword.toLowerCase();
    const existing = mergedMap.get(key);

    if (!existing) {
      // Neues Keyword → übernehmen
      mergedMap.set(key, { ...hint });
    } else {
      // Duplikat: Statischer Hint hat Priorität, aber weight kann überschrieben werden
      // wenn der generierte Hint ein höheres weight hat
      if (
        hint.weight !== undefined &&
        (existing.weight === undefined || hint.weight > existing.weight)
      ) {
        existing.weight = hint.weight;
      }
      // Weitere Felder (categoryHint, attributes) können optional vom generierten Hint ergänzt werden,
      // wenn sie im statischen Hint fehlen
      if (!existing.categoryHint && hint.categoryHint) {
        existing.categoryHint = hint.categoryHint;
      }
      if (!existing.attributes && hint.attributes) {
        existing.attributes = hint.attributes;
      }
    }
  }

  // In Array konvertieren und sortieren (optional: nach weight absteigend, dann alphabetisch)
  const merged = Array.from(mergedMap.values());
  merged.sort((a, b) => {
    // Zuerst nach weight (höher = besser)
    const weightA = a.weight ?? 0;
    const weightB = b.weight ?? 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    // Dann alphabetisch nach keyword
    return a.keyword.localeCompare(b.keyword);
  });

  return merged;
}

// initializeAliasMap ist jetzt in aliasMap.ts definiert und wird von dort importiert

/**
 * Gibt die aktuell aktiven Produkt-Hints zurück.
 * 
 * Kombiniert statische Hints (manuell gepflegt) mit generierten Hints
 * aus generatedProductHints.json.
 * 
 * @returns Array von ProductHint
 */
function getActiveProductHints(): ProductHint[] {
  try {
    // Generierte Hints aus JSON laden (als ProductHint[] casten)
    const generatedHints: ProductHint[] =
      (generatedProductHintsJson as unknown as ProductHint[]) ?? [];

    // Statische und generierte Hints zusammenführen
    const merged = mergeHints(staticProductHints, generatedHints);

    console.log("[EFRO ActiveHints]", {
      staticCount: staticProductHints.length,
      generatedCount: generatedHints.length,
      mergedCount: merged.length,
    });

    return merged;
  } catch (err) {
    console.error("[EFRO ActiveHints ERROR]", err);
    // Fallback nur auf statische Hints bei Fehler
    return staticProductHints;
  }
}

/**
 * Erkennt, ob der Nutzer eher eine Erklärung will
 * (Inhaltsstoffe / Material / Anwendung / Pflege).
 */
function detectExplanationMode(text: string): ExplanationMode | null {
  const t = normalize(text || "");
  if (!t) return null;

  // Zutaten / Inhaltsstoffe
  if (EXPLANATION_MODE_KEYWORDS.ingredients.some((w) => t.includes(w))) {
    return "ingredients";
  }

  // Anwendung / benutzen
  if (EXPLANATION_MODE_KEYWORDS.usage.some((w) => t.includes(w))) {
    return "usage";
  }

  // Waschen / Pflege
  if (EXPLANATION_MODE_KEYWORDS.washing.some((w) => t.includes(w))) {
    return "washing";
  }

  // materials / care könnten später hier ergänzt werden

  return null;
}

/**
 * Prüft, ob der Text produktbezogen ist
 */
function isProductRelated(text: string): boolean {
  const t = normalize(text || "");

  // Kern-Produkt-Keywords: Wenn eines davon vorkommt, ist es immer produktbezogen
  // Importiert aus languageRules.de.ts
  if (CORE_PRODUCT_KEYWORDS.some((w) => t.includes(w))) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: "coreProductKeyword",
    });
    return true;
  }

  // Kontext-Keywords: "für die Küche", "fürs Bad", etc.
  // Importiert aus languageRules.de.ts
  if (CONTEXT_KEYWORDS.some((w) => t.includes(w))) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: "contextKeyword",
    });
    return true;
  }

  // Wörter, die auf typische Produkt-/Shopfragen hindeuten
  // HINWEIS: Die lokale productHints-Liste wurde entfernt.
  // Stattdessen wird getActiveProductHints() verwendet, um künftig
  // auch generierte Hints zu berücksichtigen.

  const activeHints = getActiveProductHints();
  let result = activeHints.some((hint) => t.includes(hint.keyword));
  let reason = result ? "productHint" : "none";

  // Budget-Sätze als produktbezogen erkennen
  // Beispiel: "Mein Budget ist 50 Euro.", "Maximal 80 €", "Ich möchte nicht mehr als 30 Euro ausgeben."
  if (!result) {
    const hasEuroNumber = /\b(\d+)\s*(€|euro|eur)\b/i.test(text);
    // Importiert aus languageRules.de.ts - nutze BUDGET_MAX_WORDS für Budget-Wort-Erkennung
    const budgetWordsForRegex = ["budget", "preis", ...BUDGET_MAX_WORDS].join("|");
    const hasBudgetWord = new RegExp(`\\b(${budgetWordsForRegex})\\b`, "i").test(
      text.toLowerCase()
    );

    if (hasEuroNumber && hasBudgetWord) {
      result = true;
      reason = "priceOnly";
    }
  }

  console.log("[EFRO ProductRelated]", {
    text,
    isProductRelated: result,
    reason,
  });
  return result;
}

/**
 * Hilfsfunktionen für Intent-Detection
 */
function detectIntentFromText(
  text: string,
  currentIntent: ShoppingIntent
): ShoppingIntent {
  const t = normalize(text);

  // Intent-Wörter importiert aus languageRules.de.ts
  if (PREMIUM_WORDS.some((w) => t.includes(w))) {
    return "premium";
  }
  if (BARGAIN_WORDS.some((w) => t.includes(w))) {
    return "bargain";
  }
  if (GIFT_WORDS.some((w) => t.includes(w))) {
    return "gift";
  }
  if (BUNDLE_WORDS.some((w) => t.includes(w))) {
    return "bundle";
  }
  if (EXPLORE_WORDS.some((w) => t.includes(w))) {
    return "explore";
  }

  return currentIntent || "quick_buy";
}

/**
 * Erkennt, ob der User explizit nach dem teuersten Produkt fragt
 */
function detectMostExpensiveRequest(text: string): boolean {
  const normalized = normalizeText(text);
  // Prüfe Patterns aus languageRules.de.ts
  for (const pattern of MOST_EXPENSIVE_PATTERNS) {
    if (typeof pattern === "string") {
      if (normalized.includes(pattern)) return true;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(normalized)) return true;
    }
  }
  return false;
}

/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * WICHTIG:
 * - Budget-Sätze ("mein Budget ist 50 Euro") werden als OBERGRENZE interpretiert → maxPrice = 50
 * - "unter / bis / höchstens" → OBERGRENZE → maxPrice = X
 * - "über / mindestens / ab" → UNTERGRENZE → minPrice = X
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * WICHTIG:
 * - Budget-Sätze ("mein Budget ist 50 Euro") werden als OBERGRENZE interpretiert → maxPrice = 50
 * - "unter / bis / höchstens / maximal / nicht mehr als" → OBERGRENZE → maxPrice = X
 * - "über / mindestens / ab / mehr als" → UNTERGRENZE → minPrice = X
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-Sätze ("mein Budget ist 50 Euro") => OBERGRENZE → maxPrice = 50
 * - "unter / bis / höchstens / maximal / nicht mehr als" => OBERGRENZE
 * - "über / mindestens / ab X Euro / mehr als"           => UNTERGRENZE
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-Sätze ("mein Budget ist 50 Euro") => OBERGRENZE → maxPrice = 50
 * - "unter / bis / höchstens / maximal / nicht mehr als" => OBERGRENZE
 * - "über / ueber / uber / mindestens / ab X Euro / mehr als" => UNTERGRENZE
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-Sätze ("mein Budget ist 50 Euro") => OBERGRENZE → maxPrice = 50
 * - "unter / bis / höchstens / maximal / weniger als / nicht mehr als" => OBERGRENZE
 * - "über / ueber / uber / mindestens / ab X Euro / mehr als / größer als" => UNTERGRENZE
 */
function extractUserPriceRange(
  text: string
): { minPrice: number | null; maxPrice: number | null } {
  const rawText = text;
  const t = rawText.toLowerCase();
  const normalized = normalize(text);

  let minPrice: number | null = null;
  let maxPrice: number | null = null;
  let budgetRange: { minPrice: number | null; maxPrice: number | null } = { minPrice, maxPrice };
  let note = "";
  let hasBudgetWord = false;
  let numbersFound: number[] = [];

  // 1) Prüfe zuerst BUDGET_RANGE_PATTERNS (zwischen/von-bis/Range)
  for (const pattern of BUDGET_RANGE_PATTERNS) {
    const match = t.match(pattern);
    if (match) {
      const v1 = parseInt(match[1], 10);
      const v2 = parseInt(match[2], 10);
    if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
      minPrice = Math.min(v1, v2);
      maxPrice = Math.max(v1, v2);
        budgetRange = { minPrice, maxPrice };
        numbersFound = [v1, v2];
        note = "Budget (DE): Bereich 'zwischen X und Y' erkannt";
        console.log("[EFRO SB Budget] Parsed budget", {
          rawText,
          hasBudgetWord: false,
          numbersFound,
          budgetRange,
          note,
        });
      return { minPrice, maxPrice };
    }
    }
  }

  // 2) Einzelner Betrag: "<Zahl> Euro" oder einfach "<Zahl>"
  const priceMatch = t.match(/(\d+)\s*(?:euro|eur|€)?/);
  if (!priceMatch) {
    console.log("[EFRO SB Budget] Parsed budget", {
      rawText,
      hasBudgetWord: false,
      numbersFound: [],
      budgetRange: { minPrice, maxPrice },
      note: "Keine Zahl gefunden",
    });
    return { minPrice, maxPrice };
  }

  const amount = parseInt(priceMatch[1], 10);
  if (Number.isNaN(amount)) {
    console.log("[EFRO SB Budget] Parsed budget", {
      rawText,
      hasBudgetWord: false,
      numbersFound: [],
      budgetRange: { minPrice, maxPrice },
      note: "Ungültige Zahl",
    });
    return { minPrice, maxPrice };
  }

  numbersFound = [amount];

  // Budget-Wort-Erkennung
  hasBudgetWord =
    BUDGET_WORD_PATTERNS.some((pattern) => t.includes(pattern)) ||
    /\bbudget\b/i.test(t);

  // Prüfe MIN/MAX/AROUND-Wörter
  const hasMinWord = BUDGET_MIN_WORDS.some((w) => t.includes(w));
  const hasMaxWord = BUDGET_MAX_WORDS.some((w) => t.includes(w));
  const hasAroundWord = BUDGET_AROUND_WORDS.some((w) => t.includes(w));

  // 3) Budget-Sätze: Interpretation abhängig von MIN/MAX-Wörtern (DEUTSCHE LESART)
  if (hasBudgetWord) {
    if (hasMinWord) {
      // Untergrenze: "Mein Budget ist ab 600 Euro" oder "Mein Budget ist mindestens 600 Euro"
      budgetRange.minPrice = amount;
      budgetRange.maxPrice = null;
      note = "Budget (DE): Untergrenze erkannt (minPrice) - ab/mindestens";
    } else if (hasMaxWord) {
      // Obergrenze: "Mein Budget ist über 600 Euro", "bis 600", "unter 600", "höchstens 600"
      // WICHTIG: "über" wird im Deutschen Budget-Kontext als Obergrenze interpretiert
      budgetRange.minPrice = null;
      budgetRange.maxPrice = amount;
      note = "Budget (DE): 'über'/'bis'/'unter'/'höchstens' als Obergrenze interpretiert (maxPrice)";
    } else if (hasAroundWord) {
      // Ungefähr: vorerst als Obergrenze behandeln
      budgetRange.minPrice = null;
      budgetRange.maxPrice = amount;
      note = "Budget (DE): um/circa/ca. wird vorerst als Obergrenze (maxPrice) behandelt";
  } else {
      // Fallback: neutrale Angabe, als Obergrenze interpretiert
      budgetRange.minPrice = null;
      budgetRange.maxPrice = amount;
      note = "Budget (DE): neutrale Angabe, als maxPrice interpretiert";
    }
    minPrice = budgetRange.minPrice;
    maxPrice = budgetRange.maxPrice;
    console.log("[EFRO SB Budget] Parsed budget", {
      rawText,
      hasBudgetWord: true,
      numbersFound,
      budgetRange,
      note,
    });
    return { minPrice, maxPrice };
  }

  // 4) Normale Sätze (ohne "Budget"-Wort)
  if (hasMinWord && amount != null) {
    // Untergrenze: "ab 600", "mindestens 600"
    budgetRange.minPrice = amount;
    budgetRange.maxPrice = null;
    note = "Budget (DE): Untergrenze erkannt (minPrice) - ab/mindestens";
    minPrice = budgetRange.minPrice;
    maxPrice = budgetRange.maxPrice;
  } else if (hasMaxWord && amount != null) {
    // Obergrenze: "über 600", "bis 600", "unter 600", "höchstens 600", "maximal 600"
    // WICHTIG: "über" wird auch hier als Obergrenze interpretiert
    budgetRange.maxPrice = amount;
    budgetRange.minPrice = null;
    note = "Budget (DE): 'über'/'bis'/'unter'/'höchstens' als Obergrenze interpretiert (maxPrice)";
    minPrice = budgetRange.minPrice;
    maxPrice = budgetRange.maxPrice;
  } else if (hasAroundWord && amount != null) {
    // Ungefähr: vorerst als Obergrenze behandeln
    budgetRange.maxPrice = amount;
    budgetRange.minPrice = null;
    note = "Budget (DE): um/circa/ca. wird vorerst als Obergrenze (maxPrice) behandelt";
    minPrice = budgetRange.minPrice;
    maxPrice = budgetRange.maxPrice;
  } else if (amount != null) {
    // Fallback: einfache Zahl, als Obergrenze interpretieren
    if (budgetRange.maxPrice == null && budgetRange.minPrice == null) {
      budgetRange.maxPrice = amount;
      budgetRange.minPrice = null;
      note = "Budget (DE): einfache Zahl, als Obergrenze (maxPrice) interpretiert";
      minPrice = budgetRange.minPrice;
      maxPrice = budgetRange.maxPrice;
    }
  }

  console.log("[EFRO SB Budget] Parsed budget", {
    rawText,
    hasBudgetWord,
    numbersFound,
    budgetRange,
    note,
  });

  return { minPrice, maxPrice };
}



/**
 * Baut einen dynamischen Attribut-Index aus allen Produkten.
 *
 * Erkennt heuristisch Attribute wie:
 * - skin_type: "dry", "sensitive", "oily", "combination", "mature"
 * - audience: "men", "women", "kids", "baby", "unisex"
 * - pet: "dog", "cat", "pet"
 * - room: "bathroom", "kitchen", "living_room", "bedroom"
 * - family: "shower_gel", "shampoo", "hoodie", "cleaner", "wipes", "spray", "cream", "oil", "soap"
 *
 * Diese Funktion wird in einem späteren Schritt von EFRO genutzt,
 * um pro Shop eine Lernbasis für Attribute aufzubauen.
 */
function buildAttributeIndex(allProducts: EfroProduct[]): AttributeIndex {
  const perProduct: Record<string, ProductAttributeMap> = {};

  // Vokabular-Sammlung: key -> { values: Set, examples: string[], count: number }
  const vocabMap = new Map<
    string,
    {
      values: Set<string>;
      examples: string[];
      usageCount: number;
    }
  >();

  /**
   * Hilfsfunktion: Fügt ein Attribut zu einem Produkt hinzu
   */
  function addAttribute(
    productId: string,
    attributeKey: string,
    attributeValue: string
  ): void {
    if (!perProduct[productId]) {
      perProduct[productId] = {};
    }

    const productAttrs = perProduct[productId];

    if (!productAttrs[attributeKey]) {
      productAttrs[attributeKey] = [];
    }

    if (!productAttrs[attributeKey].includes(attributeValue)) {
      productAttrs[attributeKey].push(attributeValue);
    }

    if (!vocabMap.has(attributeKey)) {
      vocabMap.set(attributeKey, {
        values: new Set<string>(),
        examples: [],
        usageCount: 0,
      });
    }

    const vocab = vocabMap.get(attributeKey)!;
    vocab.values.add(attributeValue);
    vocab.usageCount += 1;

    // Beispiel-Titel hinzufügen (max. 3 verschiedene)
    const product = allProducts.find((p) => p.id === productId);
    if (product && vocab.examples.length < 3) {
      if (!vocab.examples.includes(product.title)) {
        vocab.examples.push(product.title);
      }
    }
  }

  /**
   * Hilfsfunktion: Erkennt Hauttyp-Attribute
   */
  function detectSkinType(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /trockenhaut|trockene\s+haut|trockener\s+haut|dry\s+skin/.test(normalized)
    ) {
      addAttribute(productId, "skin_type", "dry");
    }

    if (
      /empfindliche\s+haut|empfindlicher\s+haut|empfindlich|sensible\s+haut|sensibler\s+haut|sensitive\s+skin/.test(
        normalized
      )
    ) {
      addAttribute(productId, "skin_type", "sensitive");
    }

    if (
      /fettige\s+haut|fettiger\s+haut|fettig|oily\s+skin/.test(normalized)
    ) {
      addAttribute(productId, "skin_type", "oily");
    }

    if (/mischhaut|combination\s+skin/.test(normalized)) {
      addAttribute(productId, "skin_type", "combination");
    }

    if (
      /reife\s+haut|reifer\s+haut|reif|mature\s+skin|anti-?aging|anti\s+aging/.test(
        normalized
      )
    ) {
      addAttribute(productId, "skin_type", "mature");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Zielgruppe (Audience)
   */
  function detectAudience(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+herren|für\s+männer|for\s+men\b|herren\b|männer\b|\bmen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "men");
    }

    if (
      /für\s+damen|für\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "women");
    }

    if (
      /für\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|für\s+jungs|für\s+mädchen/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "kids");
    }

    if (
      /für\s+babys|für\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "baby");
    }

    if (/unisex\b|für\s+alle|for\s+all\b/.test(normalized)) {
      addAttribute(productId, "audience", "unisex");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Tier-Attribute
   */
  function detectPet(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+hunde|for\s+dog\b|\bhund\b|\bhunde\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "dog");
    }

    if (
      /für\s+katzen|for\s+cat\b|\bkatze\b|\bkatzen\b|\bcat\b|\bcats\b|\bkitten\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "cat");
    }

    if (
      !perProduct[productId]?.pet &&
      /haustier|haustiere|\bpet\b|\bpets\b|für\s+tiere/.test(normalized)
    ) {
      addAttribute(productId, "pet", "pet");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Raum / Einsatzort
   */
  function detectRoom(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+bad|für\s+badezimmer|for\s+bathroom\b|\bbad\b|\bbadezimmer\b|\bbathroom\b|\bbath\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "bathroom");
    }

    if (
      /für\s+küche|für\s+kueche|for\s+kitchen\b|\bküche\b|\bkueche\b|\bkitchen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "kitchen");
    }

    if (
      /für\s+wohnzimmer|for\s+living\s+room\b|\bwohnzimmer\b|\bliving\s+room\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "living_room");
    }

    if (
      /für\s+schlafzimmer|for\s+bedroom\b|\bschlafzimmer\b|\bbedroom\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "bedroom");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Produkt-Familien
   */
  function detectFamily(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (/duschgel|shower\s+gel|dusch\s+gel/.test(normalized)) {
      addAttribute(productId, "family", "shower_gel");
    }

    if (/shampoo|shamp\b/.test(normalized)) {
      addAttribute(productId, "family", "shampoo");
    }

    if (/hoodie|hoody/.test(normalized)) {
      addAttribute(productId, "family", "hoodie");
    }

    if (/reiniger|cleaner|reinigungs|cleaning/.test(normalized)) {
      addAttribute(productId, "family", "cleaner");
    }

    if (/tücher|tuecher|tuch|wipes/.test(normalized)) {
      addAttribute(productId, "family", "wipes");
    }

    if (/\bspray\b/.test(normalized)) {
      addAttribute(productId, "family", "spray");
    }

    if (/creme|cream|lotion/.test(normalized)) {
      addAttribute(productId, "family", "cream");
    }

    if (/\böl\b|\boil\b/.test(normalized)) {
      addAttribute(productId, "family", "oil");
    }

    if (/seife|soap/.test(normalized)) {
      addAttribute(productId, "family", "soap");
    }

    // NEU: Napf/Fressnapf als eigene Familie "bowl"
    if (/napf|fressnapf|futternapf/.test(normalized)) {
      addAttribute(productId, "family", "bowl");
    }
  }

  // Haupt-Loop: Durch alle Produkte iterieren
  for (const product of allProducts) {
    const productId = product.id;

    const tagsText =
      Array.isArray((product as any).tags)
        ? (product as any).tags.join(" ")
        : typeof (product as any).tags === "string"
        ? (product as any).tags
        : "";

    const aggregatedText = normalizeText(
      [
        product.title,
        product.description || "",
        product.category || "",
        tagsText,
      ].join(" ")
    );

    detectSkinType(aggregatedText, productId);
    detectAudience(aggregatedText, productId);
    detectPet(aggregatedText, productId);
    detectRoom(aggregatedText, productId);
    detectFamily(aggregatedText, productId);
  }

  const vocabulary: ShopAttributeVocabulary[] = Array.from(
    vocabMap.entries()
  ).map(([key, data]) => ({
    key,
    values: Array.from(data.values).sort(),
    examples: data.examples.slice(0, 3),
    usageCount: data.usageCount,
  }));

  vocabulary.sort((a, b) => b.usageCount - a.usageCount);

  return {
    perProduct,
    vocabulary,
  };
}

/**
 * Query in Produktkern und Attribute aufteilen
 */
type ParsedQuery = {
  coreTerms: string[];              // Produktbegriffe (duschgel, hoodie, tuch, reiniger …)
  attributeTerms: string[];         // Begriffe/Phrasen, die wie Bedingungen klingen (trockene, haut, herren, vegan …)
  attributeFilters: ProductAttributeMap; // strukturierte Filter, z. B. { skin_type: ["dry"], audience: ["men"] }
};

function parseQueryForAttributes(text: string): ParsedQuery {
  const normalized = normalizeText(text);

  const stopwords = QUERY_STOPWORDS;

  // 2-Wort-Phrasen erkennen
  const attributePhrases = ATTRIBUTE_PHRASES;

  const foundPhrases: string[] = [];
  let remainingText = normalized;

  // Phrasen extrahieren
  for (const phrase of attributePhrases) {
    if (remainingText.includes(phrase)) {
      foundPhrases.push(phrase);
      // Phrase aus Text entfernen, um Doppelzählung zu vermeiden
      remainingText = remainingText.replace(phrase, " ");
    }
  }

  // Einzelwörter aus dem verbleibenden Text
  const remainingTokens = remainingText
    .split(" ")
    .filter((t) => t.length >= 3 && !stopwords.includes(t));

  // Attribute-Terms: Phrasen + einzelne Wörter, die typischerweise Attribute sind
  const attributeKeywords = ATTRIBUTE_KEYWORDS;

  const attributeTerms: string[] = [...foundPhrases];
  const coreTerms: string[] = [];

  for (const token of remainingTokens) {
    if (
      attributeKeywords.includes(token) ||
      foundPhrases.some((p) => p.includes(token))
    ) {
      if (!attributeTerms.includes(token)) {
        attributeTerms.push(token);
      }
    } else {
      coreTerms.push(token);
    }
  }

  // NEU: Strukturierte Attribute-Filter aufbauen
  const attributeFilters: ProductAttributeMap = {};

  /**
   * Hilfsfunktion: Fügt einen Filter-Wert hinzu
   */
  function addFilter(key: string, value: string): void {
    if (!attributeFilters[key]) {
      attributeFilters[key] = [];
    }
    if (!attributeFilters[key].includes(value)) {
      attributeFilters[key].push(value);
    }
  }

  // skin_type Erkennung
  if (
    /trockenhaut|trockene\s+haut|trockener\s+haut|dry\s+skin/.test(normalized)
  ) {
    addFilter("skin_type", "dry");
  }
  if (
    /empfindliche\s+haut|empfindlicher\s+haut|empfindlich|sensible\s+haut|sensibler\s+haut|sensitive\s+skin/.test(
      normalized
    )
  ) {
    addFilter("skin_type", "sensitive");
  }
  if (
    /fettige\s+haut|fettiger\s+haut|fettig|oily\s+skin/.test(normalized)
  ) {
    addFilter("skin_type", "oily");
  }
  if (/mischhaut|combination\s+skin/.test(normalized)) {
    addFilter("skin_type", "combination");
  }
  if (
    /reife\s+haut|reifer\s+haut|reif|mature\s+skin|anti-?aging|anti\s+aging/.test(
      normalized
    )
  ) {
    addFilter("skin_type", "mature");
  }

  // Anti-Aging wird wie "reife Haut" behandelt
  if (/anti-aging|anti aging|antiaging|anti age/.test(normalized)) {
    addFilter("skin_type", "mature");
  }

  // audience Erkennung
  if (
    /für\s+herren|für\s+männer|for\s+men\b|herren\b|männer\b|\bmen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "men");
  }
  if (
    /für\s+damen|für\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "women");
  }
  if (
    /für\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|für\s+jungs|für\s+mädchen/.test(
      normalized
    )
  ) {
    addFilter("audience", "kids");
  }
  if (
    /für\s+babys|für\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "baby");
  }
  if (/unisex\b|für\s+alle|for\s+all\b/.test(normalized)) {
    addFilter("audience", "unisex");
  }

  // pet Erkennung
  if (
    /für\s+hunde|hund\b|\bhunde\b|for\s+dog\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "dog");
  }
  if (
    /für\s+katzen|katze\b|\bkatzen\b|for\s+cat\b|\bcat\b|\bcats\b|\bkitten\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "cat");
  }
  // Allgemein Haustier (nur wenn nicht bereits dog oder cat gesetzt)
  if (
    !attributeFilters.pet &&
    /haustier|haustiere|\bpet\b|\bpets\b|für\s+tiere/.test(normalized)
  ) {
    addFilter("pet", "pet");
  }

  // room Erkennung
  if (
    /für\s+bad|für\s+badezimmer|\bbad\b|\bbadezimmer\b|for\s+bathroom\b|\bbathroom\b|\bbath\b/.test(
      normalized
    )
  ) {
    addFilter("room", "bathroom");
  }
  if (
    /für\s+küche|für\s+kueche|\bküche\b|\bkueche\b|for\s+kitchen\b|\bkitchen\b/.test(
      normalized
    )
  ) {
    addFilter("room", "kitchen");
  }
  if (
    /für\s+wohnzimmer|\bwohnzimmer\b|for\s+living\s+room\b|\bliving\s+room\b/.test(
      normalized
    )
  ) {
    addFilter("room", "living_room");
  }
  if (
    /für\s+schlafzimmer|\bschlafzimmer\b|for\s+bedroom\b|\bbedroom\b/.test(
      normalized
    )
  ) {
    addFilter("room", "bedroom");
  }

  // family Erkennung
  if (/duschgel|shower\s+gel|dusch\s+gel/.test(normalized)) {
    addFilter("family", "shower_gel");
  }
  if (/shampoo|shamp\b/.test(normalized)) {
    addFilter("family", "shampoo");
  }
  if (/hoodie|hoody/.test(normalized)) {
    addFilter("family", "hoodie");
  }
  if (/reiniger|cleaner|reinigungs|cleaning|schmutz|verschmutz|verschmutzungen|fleck|flecken|kalk/.test(normalized)) {
    addFilter("family", "cleaner");
  }
  if (/tücher|tuecher|tuch|wipes/.test(normalized)) {
    addFilter("family", "wipes");
  }
  if (/\bspray\b/.test(normalized)) {
    addFilter("family", "spray");
  }
  if (/creme|cream|lotion/.test(normalized)) {
    addFilter("family", "cream");
  }
  if (/\böl\b|\boil\b/.test(normalized)) {
    addFilter("family", "oil");
  }
  if (/seife|soap/.test(normalized)) {
    addFilter("family", "soap");
  }

  return {
    coreTerms,
    attributeTerms,
    attributeFilters,
  };
}

/**
 * Erweitert Wörter um Katalog-Keywords, wenn sie als Komposita erkannt werden.
 * 
 * Beispiel: "fressnapf" → ["fressnapf", "napf"] (wenn "napf" im Katalog vorkommt)
 * 
 * @param words Array von normalisierten User-Wörtern
 * @param catalogKeywords Array von bekannten Katalog-Keywords
 * @returns Erweiterte Liste von Wörtern (inkl. Originale + aufgebrochene Komposita)
 */
function expandWordsWithCatalogKeywords(
  words: string[],
  catalogKeywords: string[]
): string[] {
  const result = new Set<string>();
  const keywordSet = new Set(
    catalogKeywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length >= 3)
  );

  for (const w of words) {
    const lower = w.toLowerCase().trim();
    if (!lower) continue;

    // Original-Wort immer behalten
    result.add(lower);

    // Heuristik: wenn das Wort mit einem bekannten Keyword endet,
    // z. B. "fressnapf" -> "napf", dann dieses Keyword zusätzlich übernehmen.
    for (const kw of keywordSet) {
      if (lower !== kw && lower.endsWith(kw)) {
        result.add(kw);
      }
    }
  }

  const expanded = Array.from(result);
  console.log("[EFRO CompoundSplit]", { words, expanded });
  return expanded;
}

/**
 * Simple fuzzy helper: findet nahe Tokens im Katalog für ein gegebenes Wort
 * 
 * Verwendet eine einfache Heuristik basierend auf Längenunterschied und Substring-Matching.
 * 
 * @param term Der zu suchende Begriff (normalisiert)
 * @param catalogKeywords Array von bekannten Katalog-Keywords
 * @param maxDistance Maximale Längendifferenz (Standard: 2)
 * @returns Array von gefundenen Fuzzy-Matches
 */
function getClosestCatalogTokens(
  term: string,
  catalogKeywords: string[],
  maxDistance: number = 2
): string[] {
  if (!term || term.length < 3) return [];

  const normalizedTerm = normalizeAliasKey(term);
  const matches: string[] = [];

  for (const keyword of catalogKeywords) {
    if (!keyword || keyword.length < 3) continue;

    const normalizedKeyword = normalizeAliasKey(keyword);

    // Exakte Übereinstimmung
    if (normalizedKeyword === normalizedTerm) {
      matches.push(keyword);
      continue;
    }

    // Sehr einfache Distanz-Heuristik: Länge + enthalten
    const lengthDiff = Math.abs(normalizedKeyword.length - normalizedTerm.length);
    const contains =
      normalizedKeyword.includes(normalizedTerm) || normalizedTerm.includes(normalizedKeyword);

    if (lengthDiff <= maxDistance || contains) {
      matches.push(keyword);
    }
  }

  // Begrenze auf Top 3 Matches
  const limitedMatches = matches.slice(0, 3);

  if (limitedMatches.length > 0) {
    console.log("[EFRO FuzzyResolve]", {
      term,
      fuzzyMatches: limitedMatches,
      maxDistance,
    });
  }

  return limitedMatches;
}

/**
 * Identifiziert unbekannte Begriffe im User-Text und löst sie auf bekannte Keywords auf.
 * 
 * Verwendet eine Alias-Map für AI-generierte Mappings, Fuzzy-Matching für ähnliche Schreibvarianten,
 * und zusätzlich Substring-Heuristiken als Fallback.
 * 
 * @param text Der ursprüngliche User-Text
 * @param knownKeywords Array von bekannten Keywords (aus Katalog + erweiterte User-Wörter)
 * @param aliasMap Alias-Map mit Mappings von unbekannten Begriffen zu bekannten Keywords
 * @returns Objekt mit unbekannten Begriffen und aufgelösten Begriffen
 */
type UnknownTermsResult = {
  rawTerms: string[];
  normalizedTerms: string[];
  unknownTerms: string[];
  resolved: string[];
  aliasMapUsed: boolean;
};

function resolveUnknownTerms(
  text: string,
  knownKeywords: string[],
  aliasMap: AliasMap
): UnknownTermsResult {
  // Token-Extraktion: Gleiche Logik wie in filterProducts
  const normalizedText = normalizeText(text || "");
  const rawTerms = normalizedText
    .split(/[^a-z0-9äöüß]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  // WICHTIG: Nur normalizeAliasKey verwenden für Konsistenz
  const normalizedTerms = rawTerms
    .map((t) => normalizeAliasKey(t))
    .filter((t) => t.length > 0);

  // Known-Set mit normalizeAliasKey erstellen
  const knownSet = new Set(
    (knownKeywords || [])
      .map((kw) => normalizeAliasKey(kw))
      .filter((kw) => kw.length > 0)
  );

  // Unbekannte Begriffe identifizieren
  const unknownTermsSet = new Set<string>();
  const aliasResolvedSet = new Set<string>();
  const substringResolvedSet = new Set<string>();
  let aliasMapUsed = false;

  // Schritt 1: Alias-Map-Lookup
  for (const term of normalizedTerms) {
    if (!knownSet.has(term)) {
      unknownTermsSet.add(term);

      // Alias-Lookup mit normalisiertem Key
      const aliases = (aliasMap && aliasMap[term]) || [];

      if (aliases && aliases.length > 0) {
        aliasMapUsed = true;

        for (const alias of aliases) {
          const normalizedAlias = normalizeAliasKey(alias);

          if (normalizedAlias.length > 0) {
            // Nur Aliase hinzufügen, die auch in knownSet enthalten sind
            // (damit wir keine Phantom-Wörter haben, die im Katalog gar nicht vorkommen)
            if (knownSet.has(normalizedAlias)) {
              aliasResolvedSet.add(normalizedAlias);
            }
          }
        }
      }
    }
  }

  // Schritt 2: Fuzzy-Matching als Fallback (vor Substring-Heuristik)
  // Grundlage für "smarte" Schreibvarianten (z. B. parfum → perfume mit Levenshtein-Distanz)
  const fuzzyResolvedSet = new Set<string>();
  if (!aliasMapUsed && unknownTermsSet.size > 0 && knownSet.size > 0) {
    for (const unknown of unknownTermsSet) {
      const fuzzyMatches = getClosestCatalogTokens(unknown, Array.from(knownSet));
      fuzzyMatches.forEach((match) => fuzzyResolvedSet.add(match));
    }
  }

  // Schritt 3: Substring-Heuristik als Fallback, NUR wenn Alias und Fuzzy nichts geliefert haben
  if (!aliasMapUsed && fuzzyResolvedSet.size === 0 && unknownTermsSet.size > 0 && knownSet.size > 0) {
    for (const unknown of unknownTermsSet) {
      for (const kw of knownSet) {
        if (
          kw.length >= 3 &&
          kw !== unknown &&
          (unknown.includes(kw) || kw.includes(unknown))
        ) {
          substringResolvedSet.add(kw);
        }
      }
    }
  }

  // Schritt 4: Resolved-Tokens zusammenführen (Priorität: Alias > Fuzzy > Substring)
  const resolvedSet = new Set<string>();
  if (aliasResolvedSet.size > 0) {
    // Alias-Tokens haben höchste Priorität
    aliasResolvedSet.forEach((t) => resolvedSet.add(t));
  } else if (fuzzyResolvedSet.size > 0) {
    // Fuzzy-Tokens als zweite Priorität
    fuzzyResolvedSet.forEach((t) => resolvedSet.add(t));
  } else if (substringResolvedSet.size > 0) {
    // Substring-Tokens als letzte Priorität
    substringResolvedSet.forEach((t) => resolvedSet.add(t));
  }

  const uniqUnknown = Array.from(unknownTermsSet);
  const uniqResolved = Array.from(resolvedSet);

  console.log("[EFRO UnknownTermsResolved]", {
    text,
    rawTerms,
    normalizedTerms,
    unknownTerms: uniqUnknown,
    resolved: uniqResolved,
    aliasResolved: Array.from(aliasResolvedSet),
    fuzzyResolved: Array.from(fuzzyResolvedSet),
    substringResolved: Array.from(substringResolvedSet),
    knownKeywordsCount: knownKeywords.length,
    aliasMapUsed,
    aliasMapKeys: aliasMap ? Object.keys(aliasMap).slice(0, 10) : [],
    lookupKey: uniqUnknown.length > 0 ? normalizeAliasKey(uniqUnknown[0]) : null,
    lookupResult: uniqUnknown.length > 0 ? aliasMap?.[normalizeAliasKey(uniqUnknown[0])] : null,
    // Debug: Prüfe spezifisch für "parfum" / "parfüm"
    parfumLookup: aliasMap?.[normalizeAliasKey("parfum")] || null,
    parfümLookup: aliasMap?.[normalizeAliasKey("parfüm")] || null,
    hasPerfumeInKnown: knownSet.has("perfume"),
  });

  return {
    rawTerms,
    normalizedTerms,
    unknownTerms: uniqUnknown,
    resolved: uniqResolved,
    aliasMapUsed,
  };
}

/**
 * Produkt-Scoring für Keywords
 */
function scoreProductForWords(product: EfroProduct, words: string[]): number {
  if (words.length === 0) return 0;

  const title = normalize(product.title);
  const desc = normalize(product.description || "");
  const category = normalize(product.category || "");

  // Tags robust behandeln (Array oder String)
  const rawTags: any = (product as any).tags;
  let tagsText = "";
  if (Array.isArray(rawTags)) {
    tagsText = rawTags.map((tag) => normalize(String(tag))).join(" ");
  } else if (typeof rawTags === "string") {
    tagsText = normalize(rawTags);
  }

  const blob = `${title} ${desc} ${category} ${tagsText}`;

  let score = 0;

  for (const word of words) {
    if (!word) continue;

    // Exakte Treffer – stärker gewichten
    if (title.includes(word)) {
      score += 5;
    } else if (tagsText.includes(word)) {
      score += 4;
    } else if (category.includes(word)) {
      score += 3;
    } else if (desc.includes(word)) {
      score += 2;
    }

    // NEU: robustes Fuzzy-Matching mit mehreren Präfixen (z. B. "dusch", "duschg")
    if (word.length >= 4) {
      const maxLen = Math.min(6, word.length);
      for (let len = 4; len <= maxLen; len++) {
        const prefix = word.slice(0, len);
        if (blob.includes(prefix)) {
          score += 1;
          break;
        }
      }
    }
  }

  return score;
}

/**
 * Prüft, ob ein Produkt ein echtes Parfüm-Produkt ist
 * (basierend auf Kategorie, Titel, Beschreibung, Tags)
 */
function isPerfumeProduct(product: EfroProduct): boolean {
      const title = normalize(product.title || "");
  const description = normalize(product.description || "");
  const category = normalize(product.category || ""); // ← NEU

  // Tags defensiv in ein string[] verwandeln
  const rawTags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === "string"
    ? [product.tags]
    : [];

  const tagsText = normalize(rawTags.join(" "));

  // Text-Blob für starke Keywords (ohne Kategorie, da Kategorie separat geprüft wird)
  const textBlob = `${title} ${description} ${tagsText}`;



  // Starke POSITIVE Keywords für Kategorie
  const perfumeCategoryKeywords = [
    "parfum", "parfums", "parfüm", "perfume", "perfumes",
    "duft", "düfte", "fragrance", "fragrances"
  ];

  // Starke POSITIVE Keywords für Text (Titel/Beschreibung/Tags)
  const strongTextKeywords = [
    "eau de parfum",
    "eau de toilette"
  ];

  // NEGATIVE Keywords (um "parfümfrei" etc. rauszufiltern)
  const negativeKeywords = [
    "parfumfrei",
    "parfümfrei",
    "ohne parfum",
    "ohne parfüm",
    "ohne duft",
    "ohne duftstoffe",
    "duschgel",
    "dusch gel",
    "dusch-gel",
    "shower gel",
    "body wash",
    "shampoo",
    "lotion",
    "creme",
    "reinigungstuch",
    "tuch",
    "tücher"
  ];

  // Kategorie-Check: Muss explizit Parfüm/Duft/Fragrance enthalten
  const categoryHasPerfume = perfumeCategoryKeywords.some(kw =>
    category.includes(kw)
  );

  // Text-Check: Starke Parfüm-Keywords in Titel/Beschreibung/Tags
  const textHasStrongPerfume = strongTextKeywords.some(kw =>
    textBlob.includes(kw)
  );

  // Negative-Check: Ausschluss-Kriterien
  const textHasNegative = negativeKeywords.some(kw =>
    textBlob.includes(kw) || category.includes(kw)
  );

  // Nur als Parfüm werten, wenn:
  // - Kategorie explizit Parfüm/Duft/Fragrance ODER starke Text-Keywords vorhanden
  // UND keine negativen Keywords vorhanden
  return (categoryHasPerfume || textHasStrongPerfume) && !textHasNegative;
}

/**
 * Hilfsfunktion: Sammelt Matches aus einem Dictionary von Keywords
 */
function collectMatches(
  text: string,
  dict: Record<string, string[]>
): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const [key, patterns] of Object.entries(dict)) {
    for (const p of patterns) {
      if (t.includes(p.toLowerCase())) {
        hits.push(key);
        break;
      }
    }
  }
  return Array.from(new Set(hits));
}

/**
 * Prüft, ob der Nutzertext explizit nach Parfüm fragt
 */
function userMentionsPerfume(text: string): boolean {
  const normalizedText = normalize(text);
  return PERFUME_SYNONYMS.some((syn) => normalizedText.includes(syn));
}

/**
 * Produkte nach Keywords, Kategorie und Preis filtern
 * – NIE wieder [] zurückgeben, solange allProducts nicht leer ist.
 */
function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[],
  contextCategory?: string | null
): EfroProduct[] {
  // WICHTIG: Parfüm-Flags GANZ AM ANFANG deklarieren, vor allen Logs und if-Blocks
  let hasPerfumeCandidates = false;
  let originalPerfumeCandidates: EfroProduct[] = [];
  
  // WICHTIG: candidates muss GANZ AM ANFANG deklariert werden, vor allen Logs
  let candidates: EfroProduct[] = [...allProducts];

  // Preisbereich extrahieren für ENTER-Log
  const { minPrice: userMinPriceForLog, maxPrice: userMaxPriceForLog } =
    extractUserPriceRange(text);

  console.log("[EFRO SB] ENTER filterProducts", {
    text: text.substring(0, 100),
    intent,
    totalProducts: allProducts.length,
    budgetRange: {
      min: userMinPriceForLog,
      max: userMaxPriceForLog,
    },
    keywordSummary: {
      textLength: text.length,
      hasPriceInfo: userMinPriceForLog !== null || userMaxPriceForLog !== null,
    },
  });

  // Intent kann innerhalb der Funktion angepasst werden
  let currentIntent: ShoppingIntent = intent;

  const t = normalize(text);

  // Erkenne, ob User explizit nach dem teuersten Produkt fragt
  const wantsMostExpensive = detectMostExpensiveRequest(text);

  // Dynamischen Attribut-Index für alle Produkte bauen
  const attributeIndex = buildAttributeIndex(allProducts);

  if (allProducts.length === 0) {
    console.log("[EFRO Filter RESULT]", {
      text,
      intent: currentIntent,
      resultTitles: [],
    });
    return [];
  }

  const { minPrice: userMinPrice, maxPrice: userMaxPrice } =
    extractUserPriceRange(text);
  
  // Log nach Preis-Extraktion (noch vor Anwendung)
  console.log("[EFRO SB] PRICE EXTRACTED", {
    text: text.substring(0, 80),
    userMinPrice,
    userMaxPrice,
    candidateCountBeforePriceFilter: candidates.length,
  });

  /**
   * 1) Kategorie-Erkennung
   */
  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => normalize(p.category || ""))
        .filter((c) => c.length >= 3)
    )
  );

  const categoryHintsInText: string[] = [];
  const matchedCategories: string[] = [];

  const catRegex = /kategorie\s+([a-zäöüß]+)/;
  const catMatch = t.match(catRegex);
  if (catMatch && catMatch[1]) {
    const catWord = catMatch[1];
    categoryHintsInText.push(catWord);
    allCategories.forEach((cat) => {
      if (cat.includes(catWord)) {
        matchedCategories.push(cat);
      }
    });
  } else {
    allCategories.forEach((cat) => {
      if (cat && t.includes(cat)) {
        matchedCategories.push(cat);
        categoryHintsInText.push(cat);
      }
    });
  }

  // Wort-Classification: Kategorien aus languageRules.de erkennen (additiv)
  const fullTextLowerForCategory = t.toLowerCase();
  const categoryHintsFromRules = collectMatches(fullTextLowerForCategory, CATEGORY_KEYWORDS);
  
  // categoryHints additiv zu matchedCategories hinzufügen (nur wenn noch nicht vorhanden)
  for (const hint of categoryHintsFromRules) {
    const normalizedHint = normalize(hint);
    // Prüfe, ob die Kategorie bereits in matchedCategories oder allCategories vorhanden ist
    const existsInCategories = allCategories.some((cat) => normalize(cat) === normalizedHint);
    if (existsInCategories && !matchedCategories.some((cat) => normalize(cat) === normalizedHint)) {
      // Kategorie aus categoryHints hinzufügen, wenn sie im Katalog existiert
      const matchingCategory = allCategories.find((cat) => normalize(cat) === normalizedHint);
      if (matchingCategory) {
        matchedCategories.push(matchingCategory);
        categoryHintsInText.push(matchingCategory);
      }
    }
  }

  // KONEXT-LOGIK: Wenn keine neue Kategorie im Text erkannt wurde, aber contextCategory vorhanden ist
  // → nutze contextCategory als effectiveCategory
  let effectiveCategorySlug: string | null = null;

  if (matchedCategories.length > 0) {
    // Neue Kategorie im Text erkannt → diese hat Vorrang
    effectiveCategorySlug = matchedCategories[0]; // Nimm die erste gefundene Kategorie
  } else if (contextCategory) {
    // Keine neue Kategorie im Text, aber Kontext vorhanden → nutze Kontext
    effectiveCategorySlug = normalize(contextCategory);
  } else if (categoryHintsFromRules.length > 0) {
    // Fallback: Wenn categoryHints vorhanden sind, aber keine matchedCategories, versuche die erste categoryHint zu nutzen
    const firstHint = categoryHintsFromRules[0];
    const normalizedHint = normalize(firstHint);
    const matchingCategory = allCategories.find((cat) => normalize(cat) === normalizedHint);
    if (matchingCategory) {
      effectiveCategorySlug = normalize(matchingCategory);
    }
  }

  console.log("[EFRO SB Category] Effective category", {
    fromText: matchedCategories.length > 0 ? matchedCategories[0] : null,
    fromContext: contextCategory ?? null,
    effective: effectiveCategorySlug,
  });

  // Filtere nach effectiveCategorySlug (entweder aus Text oder aus Kontext)
  if (effectiveCategorySlug) {
    const beforeCategoryFilter = candidates.length;
    candidates = candidates.filter((p) =>
      normalize(p.category || "") === effectiveCategorySlug
    );
    
    // TODO Vorschlag: Bei Budget-only Anfragen (ohne Produktkategorie) könnte man
    // den Kategorie-Filter optional machen, damit nicht alle Produkte wegfallen.
    // Aktuell: Kategorie-Filter ist hart, was bei "zeig mir Parfüm" korrekt ist,
    // aber bei "50 Euro Budget" ohne Kategorie könnte es zu streng sein.
    
    console.log("[EFRO SB] AFTER CATEGORY FILTER", {
      text: text.substring(0, 80),
      matchedCategories,
      effectiveCategorySlug,
      beforeCount: beforeCategoryFilter,
      afterCount: candidates.length,
      isBudgetOnly: (userMinPrice !== null || userMaxPrice !== null) && matchedCategories.length === 0,
    });
  } else {
    // Keine Kategorie-Matches und kein Kontext: Log für Budget-only Szenarien
    // WICHTIG: Nur loggen, wenn wirklich kein Kontext vorhanden ist
    if (userMinPrice !== null || userMaxPrice !== null) {
      if (!contextCategory) {
        console.log("[EFRO SB] CATEGORY FILTER SKIPPED (budget-only query, no context)", {
          text: text.substring(0, 80),
          userMinPrice,
          userMaxPrice,
          candidateCount: candidates.length,
          contextCategory: null,
        });
      } else {
        console.log("[EFRO SB] CATEGORY FILTER APPLIED (budget-only query, using context)", {
          text: text.substring(0, 80),
          userMinPrice,
          userMaxPrice,
          contextCategory,
          effectiveCategorySlug,
          candidateCount: candidates.length,
        });
      }
    }
  }

  console.log("[EFRO SB] AFTER CATEGORY FILTER", {
    text: text.substring(0, 80),
    matchedCategories,
    categoryHintsInText,
    candidateCount: candidates.length,
  });

  /**
   * 2) Generische Keyword-Suche
   */
  const intentWords = INTENT_WORDS;

  let words: string[] = t
    .split(/[^a-z0-9äöüß]+/i)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !intentWords.includes(w));

  // reine Zahlen nicht als Keyword benutzen
  words = words.filter((w) => !/^\d+$/.test(w));

  // Katalog-Keywords aus allen Produkten extrahieren
  const catalogKeywordsSet = new Set<string>();
  for (const product of allProducts) {
    // Kategorie normalisieren und hinzufügen (wichtig für canonicalTokens)
    if (product.category) {
      const catNormalized = normalizeText(product.category);
      const catWords = catNormalized.split(/\s+/).filter((w) => w.length >= 3);
      catWords.forEach((w) => catalogKeywordsSet.add(w));
      // Auch die gesamte normalisierte Kategorie als Token hinzufügen (konsistent mit normalizeAliasKey)
      // z. B. "Perfume" -> "perfume" (für Language-Aliase wie "parfum" -> "perfume")
      const fullCat = normalizeAliasKey(product.category);
      if (fullCat && fullCat.length >= 3) {
        catalogKeywordsSet.add(fullCat);
      }
    }

    // Titel normalisieren und splitten
    const titleWords = normalizeText(product.title || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    titleWords.forEach((w) => catalogKeywordsSet.add(w));

    // Beschreibung normalisieren und splitten
    const descWords = normalizeText(product.description || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    descWords.forEach((w) => catalogKeywordsSet.add(w));

    // Tags normalisieren und splitten
    const rawTags = (product as any).tags;
    if (Array.isArray(rawTags)) {
      rawTags.forEach((tag: string) => {
        const tagWords = normalizeText(String(tag))
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        tagWords.forEach((w) => catalogKeywordsSet.add(w));
      });
    } else if (typeof rawTags === "string") {
      const tagWords = normalizeText(rawTags)
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      tagWords.forEach((w) => catalogKeywordsSet.add(w));
    }
  }
  const catalogKeywords = Array.from(catalogKeywordsSet);

  // Alias-Map initialisieren und filtern (nur Keywords, die im Katalog vorkommen)
  const aliasMap = initializeAliasMap(catalogKeywords);

  // Wörter mit Katalog-Keywords erweitern (Komposita aufbrechen)
  let expandedWords = expandWordsWithCatalogKeywords(words, catalogKeywords);

  // Query in Core- und Attribute-Terms aufteilen (für Log)
  const parsedForLog = parseQueryForAttributes(text);
  
  // Wort-Classification: Kategorien, Usage, Skin-Keywords erkennen
  const fullTextLower = t.toLowerCase();
  const categoryHints = collectMatches(fullTextLower, CATEGORY_KEYWORDS);
  const usageHints = collectMatches(fullTextLower, USAGE_KEYWORDS);
  const skinHints = collectMatches(fullTextLower, SKIN_KEYWORDS);
  
  // keywordSummary erweitern (falls noch nicht vorhanden, hier initialisieren)
  const keywordSummary = {
    categoryHints,
    usageHints,
    skinHints,
  };
  
  console.log("[EFRO KeywordSummary]", {
    text: text.substring(0, 80),
    categoryHints,
    usageHints,
    skinHints,
  });
  
  console.log("[EFRO SB] AFTER WORD EXTRACTION", {
    text: text.substring(0, 80),
    words: expandedWords.slice(0, 10), // Nur erste 10 für Übersicht
    coreTerms: parsedForLog.coreTerms.slice(0, 10),
    attributeTerms: parsedForLog.attributeTerms.slice(0, 10),
    candidateCountBeforeKeywordMatch: candidates.length,
    keywordSummary,
  });

  // Intent-Fix: "Zeige mir X" mit konkretem Produkt → quick_buy statt explore
  const lowered = t.toLowerCase();
  const wordCount = words.length;

  const startsWithShowMe =
    lowered.startsWith("zeige mir ") ||
    lowered.startsWith("zeig mir ") ||
    lowered.startsWith("show me ");

  if (currentIntent === "explore" && startsWithShowMe && wordCount > 0 && wordCount <= 4) {
    currentIntent = "quick_buy";
    console.log("[EFRO IntentFix] Upgraded explore -> quick_buy for 'zeige mir' pattern", {
    text,
    words,
      wordCount,
    });
  }

  // --- EFRO Alias-Preprocessing -----------------------------------------
  // Alias-Map VOR dem Keyword-Matching anwenden, damit unbekannte Begriffe
  // (z. B. "fressnapf") in bekannte Keywords (z. B. "hunde", "napfset") aufgelöst werden
  // WICHTIG: Nur catalogKeywords übergeben, NICHT words/expandedWords,
  // damit User-Wörter wie "fressnapf" als unknownTerm erkannt werden
  const aliasResult = resolveUnknownTerms(text, catalogKeywords, aliasMap);

  // Speichere aliasResult für späteren Hard-Filter
  const unknownResult = aliasResult;

  if (aliasResult.resolved.length > 0) {
    const wordsBefore = [...words];
    const expandedBefore = [...expandedWords];
    const resolvedSet = new Set(aliasResult.resolved);

    // Wenn aliasMapUsed === true, verwende nur die Alias-resolved Tokens
    if (aliasResult.aliasMapUsed && aliasResult.resolved.length > 0) {
      const aliasResolved = aliasResult.resolved;
      const effectiveWordsSet = new Set<string>([
        ...words,
        ...aliasResolved,
      ]);

      words = Array.from(effectiveWordsSet);
      expandedWords = Array.from(effectiveWordsSet);
    } else {
      // Fallback: Normale Erweiterung
      const updatedWords = Array.from(
        new Set([
          ...words,
          ...resolvedSet,
        ])
      );

      const updatedExpandedWords = Array.from(
        new Set([
          ...(expandedWords || []),
          ...resolvedSet,
        ])
      );

      words = updatedWords;
      expandedWords = updatedExpandedWords;
    }

    console.log("[EFRO AliasPreApplied]", {
      text,
      unknownTerms: aliasResult.unknownTerms,
      resolved: aliasResult.resolved,
      aliasMapUsed: aliasResult.aliasMapUsed,
      wordsBefore,
      expandedBefore,
      wordsAfter: words,
      expandedAfter: expandedWords,
      // Debug für "Parfüm" / Language-Aliase
      ...(text.toLowerCase().includes("parf") ? {
        debugParfum: {
          normalizedText: normalizeText(text),
          hasParfumInResolved: aliasResult.resolved.includes("perfume"),
          resolvedTokens: aliasResult.resolved,
        }
      } : {}),
    });
  }
  // --- Ende EFRO Alias-Preprocessing ------------------------------------

  const hasBudget = userMinPrice !== null || userMaxPrice !== null;

  // Query in Core- und Attribute-Terms aufteilen
  const parsed = parseQueryForAttributes(text);
  const { coreTerms, attributeTerms, attributeFilters } = parsed;

  console.log("[EFRO FILTER ATTR_FILTERS]", {
    text,
    attributeFilters,
    candidateCountAfterAttr: candidates.length,
  });

  // Strukturierte Attribute-Filter aus der Query anwenden (sofern vorhanden)
  const activeAttributeFilterEntries = Object.entries(attributeFilters).filter(
    ([, values]) => Array.isArray(values) && values.length > 0
  );

  let candidatesAfterAttr = candidates;

  if (activeAttributeFilterEntries.length > 0) {
    const beforeAttrFilterCount = candidates.length;

    // Spezieller Fall: menschliche Haut-Typen, aber keine Tier-Anfrage
    if (
      attributeFilters.skin_type &&
      attributeFilters.skin_type.length > 0 &&
      (!attributeFilters.pet || attributeFilters.pet.length === 0)
    ) {
      candidatesAfterAttr = candidatesAfterAttr.filter((p) => {
        const cat = normalize(p.category || "");
        return HUMAN_SKIN_CATEGORIES.some((allowed) => cat.includes(allowed));
      });
    }

    const filteredByAttributes = candidatesAfterAttr.filter((product) => {
      const productAttrs: ProductAttributeMap =
        attributeIndex.perProduct[product.id] ?? {};

      // Alle aktiven Filter müssen matchen
      return activeAttributeFilterEntries.every(([key, values]) => {
        const prodValues = productAttrs[key] ?? [];

        if (!Array.isArray(prodValues) || prodValues.length === 0) {
          return false;
        }

        // Speziallogik für Haustiere (pet = dog/cat/pet)
        if (key === "pet") {
          const hasGeneric = prodValues.includes("pet");
          const hasDog = prodValues.includes("dog");
          const hasCat = prodValues.includes("cat");

          const wantsGeneric = values.includes("pet");
          const wantsDog = values.includes("dog");
          const wantsCat = values.includes("cat");

          // Direktes Matching (dog↔dog, cat↔cat, pet↔pet)
          const directMatch = values.some((v) => prodValues.includes(v));

          // Query: "Haustiere" (pet) → akzeptiere dog oder cat
          const genericMatchesSpecies = wantsGeneric && (hasDog || hasCat);

          // Query: "Hund(e)" bzw. "Katze(n)" → akzeptiere generische Haustier-Produkte (pet)
          const speciesMatchesGeneric =
            (wantsDog || wantsCat) && hasGeneric;

          return directMatch || genericMatchesSpecies || speciesMatchesGeneric;
        }

        // Standardfall für alle anderen Attribute
        return values.some((v) => prodValues.includes(v));
      });
    });

    if (filteredByAttributes.length > 0) {
      console.log("[EFRO Filter ATTR_FILTER_APPLIED]", {
        text,
        attributeFilters,
        beforeAttrFilterCount,
        afterAttrFilterCount: filteredByAttributes.length,
      });
      candidates = filteredByAttributes;
    } else {
      console.log("[EFRO Filter ATTR_FILTER_NO_MATCH]", {
        text,
        attributeFilters,
        beforeAttrFilterCount,
      });
      // Kein harter Filter: wir behalten die ursprünglichen Kandidaten
    }
  }

  // --- EFRO Alias-Hard-Filter ------------------------------------------
  // Bei aliasMapUsed === true: Harte Filterung auf Produkte, die Alias-Tokens enthalten
  let productsForKeywordMatch = candidates;
  
  if (unknownResult.aliasMapUsed && unknownResult.resolved.length > 0) {
    const aliasTerms = new Set(unknownResult.resolved);

    const aliasCandidates = candidates.filter((p) => {
      const haystack = normalizeText(
        [
          p.title,
          p.description || "",
          p.category || "",
          Array.isArray((p as any).tags)
            ? (p as any).tags.join(" ")
            : typeof (p as any).tags === "string"
            ? (p as any).tags
            : "",
        ].join(" ")
      ).toLowerCase();

      for (const term of aliasTerms) {
        if (term && haystack.includes(term)) {
          return true;
        }
      }
      return false;
    });

    if (aliasCandidates.length > 0) {
      console.log("[EFRO AliasHardFilter]", {
        text,
        aliasTerms: Array.from(aliasTerms),
        beforeCount: candidates.length,
        afterCount: aliasCandidates.length,
        sampleTitles: aliasCandidates.slice(0, 5).map((p) => p.title),
      });
      productsForKeywordMatch = aliasCandidates;
    }
  }
  // --- Ende EFRO Alias-Hard-Filter --------------------------------------

  // Prüfe, ob es eine sehr allgemeine Premium-Anfrage ist (ohne konkrete Produktkategorie)
  // Importiert aus languageRules.de.ts
  const hasPremiumToken =
    coreTerms.length > 0 &&
    coreTerms.some((t) => PREMIUM_TOKENS.includes(t));

  const isGenericPremiumQuery =
    currentIntent === "premium" &&
    // keine Kategorie-Hints
    categoryHintsInText.length === 0 &&
    // keine Attribute
    attributeTerms.length === 0 &&
    // mindestens ein Premium-Token in coreTerms vorhanden
    hasPremiumToken;

  if (isGenericPremiumQuery) {
    console.log("[EFRO KEYWORD_MATCHES_PREMIUM_SKIP]", {
      text,
      candidateCountBefore: candidates.length,
      coreTerms,
      attributeTerms,
      categoryHintsInText,
    });
    // candidates bleiben unverändert - KEYWORD_MATCHES wird übersprungen
  } else if (expandedWords.length > 0 || coreTerms.length > 0 || attributeTerms.length > 0) {
    // Für jedes Produkt einen searchText erstellen
    const candidatesWithScores = productsForKeywordMatch.map((p) => {
      const searchText = normalizeText(
        [
          p.title,
          p.description || "",
          p.category || "",
          Array.isArray((p as any).tags)
            ? (p as any).tags.join(" ")
            : typeof (p as any).tags === "string"
            ? (p as any).tags
            : "",
        ].join(" ")
      );

      // Core-Match: Mindestens 1 coreTerm oder expandedWord muss vorkommen
      // (erweiterte Wörter werden auch für Core-Matching verwendet)
      const hasCoreMatch =
        (coreTerms.length === 0 && expandedWords.length === 0) ||
        coreTerms.some((term) => searchText.includes(term)) ||
        expandedWords.some((word) => searchText.includes(word));

      if (!hasCoreMatch && (coreTerms.length > 0 || expandedWords.length > 0)) {
        return { product: p, score: 0, attributeScore: 0 };
      }

      // Keyword-Score mit erweiterten Wörtern (inkl. aufgebrochene Komposita)
      const keywordScore = scoreProductForWords(p, expandedWords);

      // Attribute-Score: Zähle, wie viele attributeTerms im Text vorkommen
      let attributeScore = 0;
      for (const attr of attributeTerms) {
        if (searchText.includes(attr)) {
          attributeScore += 1;
        }
      }

      // Strukturierte Attribute-Score: basiert auf attributeFilters + AttributeIndex
      let structuredAttributeScore = 0;
      const productAttrs: ProductAttributeMap =
        attributeIndex.perProduct[p.id] ?? {};

      for (const [key, values] of Object.entries(attributeFilters)) {
        const prodValues = productAttrs[key] ?? [];

        if (!Array.isArray(prodValues) || prodValues.length === 0) continue;

        if (values.some((v) => prodValues.includes(v))) {
          // Jeder passende strukturierte Filter gibt einen extra Bonus
          structuredAttributeScore += 2;
        }
      }

      // Gesamt-Score: Keywords + Text-Attribute + strukturierte Attribute
      let totalScore =
        keywordScore + attributeScore * 2 + structuredAttributeScore * 3;

      // Spezielle Ranking-Regel für "Schimmel": Bevorzuge Reiniger/Sprays, benachteilige Tücher
      // Testfälle:
      // - "Es soll Schimmel entfernen." → Reiniger/Sprays vor Tüchern
      // - "Ich brauche etwas gegen Schimmel im Bad." → Reiniger/Sprays vor Tüchern
      // - "Hast du einen Schimmelentferner für die Dusche?" → Reiniger/Sprays vor Tüchern
      const normalizedUserText = t;
      // Importiert aus languageRules.de.ts
      if (MOLD_KEYWORDS.some((kw) => normalizedUserText.includes(kw))) {
        const normalizedTitle = normalize(p.title);
        const normalizedDescription = normalize(p.description || "");
        const hasSchimmelInProduct =
          MOLD_KEYWORDS.some((kw) => normalizedTitle.includes(kw)) ||
          MOLD_KEYWORDS.some((kw) => normalizedDescription.includes(kw));

        if (hasSchimmelInProduct) {
          const scoreBefore = totalScore;
          const productFamily = productAttrs.family || [];
          // normalizedTitle ist bereits lowercase durch normalize()

          // Bonus für Reiniger/Sprays mit Schimmel-Bezug
          // Importiert aus languageRules.de.ts
          if (
            productFamily.includes("cleaner") ||
            MOLD_PRODUCT_KEYWORDS.cleaners.some((kw) => normalizedTitle.includes(kw))
          ) {
            totalScore += 3;
          }

          // Malus für Tücher/Wipes mit Schimmel-Bezug (damit sie nachrangig erscheinen)
          // Importiert aus languageRules.de.ts
          if (
            productFamily.includes("wipes") ||
            MOLD_PRODUCT_KEYWORDS.wipes.some((kw) => normalizedTitle.includes(kw))
          ) {
            totalScore -= 1;
          }

          // Debug-Log nur im Schimmel-Fall
          if (scoreBefore !== totalScore) {
            console.log("[EFRO SchimmelRanking]", {
              userText: normalizedUserText,
              appliedMoldBoost: true,
              productId: p.id,
              title: p.title,
              family: productFamily,
              scoreBefore,
              scoreAfter: totalScore,
            });
          }
        }
      }

      return { product: p, score: totalScore, attributeScore };
    });

    // Filtere Kandidaten mit Score > 0
    const scored = candidatesWithScores.filter((entry) => entry.score > 0);

    if (scored.length > 0) {
      // Sortiere nach: attributeScore (absteigend), dann totalScore, dann Preis
      scored.sort((a, b) => {
        if (b.attributeScore !== a.attributeScore) {
          return b.attributeScore - a.attributeScore;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Preis-Sortierung je nach Intent
  if (currentIntent === "premium") {
          return (b.product.price ?? 0) - (a.product.price ?? 0);
  } else if (currentIntent === "bargain") {
          return (a.product.price ?? 0) - (b.product.price ?? 0);
        }
        return 0;
      });

      candidates = scored.map((e) => e.product);

      if (candidates.length > 20) {
        candidates = candidates.slice(0, 20);
      }

      // --- Language-level synonyms: Parfum/Parfüm -> Perfume ---
      const userAskedForPerfume = userMentionsPerfume(text);

      if (userAskedForPerfume) {
        // Basis-Liste: ALLE Produkte, nicht nur die bisherigen Kandidaten
        const perfumeSource = allProducts;
        const beforeCount = perfumeSource.length;

        // WICHTIG: Hier jetzt die ganze Basis filtern, nicht nur candidates
        const perfumeCandidates = perfumeSource.filter((p) =>
          isPerfumeProduct(p)
        );

        if (perfumeCandidates.length > 0) {
          candidates = perfumeCandidates;
          hasPerfumeCandidates = true;
          originalPerfumeCandidates = [...perfumeCandidates];
        } else {
          // wenn wirklich KEIN echtes Parfüm im Sortiment ist, candidates so lassen wie vorher
        }

        console.log("[EFRO PERFUME]", {
        text,
          userAskedForPerfume,
          beforeCount,
          afterCount: perfumeCandidates.length,
          sampleTitles: perfumeCandidates.slice(0, 5).map((p) => p.title),
        });
      }

      console.log("[EFRO SB] AFTER WORD FILTER", {
        text: text.substring(0, 80),
        words: expandedWords.slice(0, 10),
        coreTerms: coreTerms.slice(0, 10),
        attributeTerms: attributeTerms.slice(0, 10),
        aliasMapUsed: unknownResult.aliasMapUsed,
        beforeCount: productsForKeywordMatch.length,
        afterCount: candidates.length,
        sampleTitles: candidates.slice(0, 5).map((p) => p.title.substring(0, 50)),
      });
  } else {
      console.log("[EFRO Filter NO_KEYWORD_MATCH]", {
        text,
        intent: currentIntent,
        words: expandedWords,
        coreTerms,
        attributeTerms,
        note: "Alias-Preprocessing wurde bereits vor dem Keyword-Matching angewendet",
      });
    }
  }

  // Debug-Log am Ende des KEYWORD_MATCHES-Blocks
  console.log("[EFRO KEYWORD_MATCHES_RESULT]", {
    text,
    intent: currentIntent,
    candidateCountAfterKeywordMatches: candidates.length,
    wasSkipped: isGenericPremiumQuery,
  });

  /**
   * PREMIUM: High-End-Filter, wenn kein expliziter Preisbereich und nicht "teuerste Produkt"
   * Filtert auf oberstes Preissegment (Top-25%, 75-Perzentil)
   */
  if (
    currentIntent === "premium" &&
    userMinPrice === null &&
    userMaxPrice === null &&
    !wantsMostExpensive
  ) {
    const priceValues = candidates
      .map((c) => c.price ?? 0)
      .filter((p) => typeof p === "number" && p > 0)
      .sort((a, b) => a - b); // Aufsteigend sortieren

    if (priceValues.length === 0) {
      console.log("[EFRO PREMIUM_HIGH_END_FILTER]", {
        text,
        skipped: true,
        reason: "no valid prices found",
      });
    } else {
      // 75-Perzentil: Top-25% der teuersten Produkte
      const idx = Math.floor(priceValues.length * 0.75);
      const threshold = priceValues[Math.min(idx, priceValues.length - 1)];

      const beforeCount = candidates.length;
      candidates = candidates.filter((c) => {
        const price = c.price ?? 0;
        return price >= threshold;
      });

      console.log("[EFRO PREMIUM_HIGH_END_FILTER]", {
        text,
        beforeCount,
        afterCount: candidates.length,
        threshold,
        priceSamples: priceValues.slice(0, 10), // nur erste 10 zur Übersicht
      });
    }
  }

  /**
   * 3) Intent-/Preis-Logik
   */
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  if (userMinPrice !== null || userMaxPrice !== null) {
    // User-Budget hat immer Vorrang
    minPrice = userMinPrice;
    maxPrice = userMaxPrice;
  } else {
    // NEU: keine harten Standard-Preisgrenzen mehr.
    // Premium/Bargain/Gift steuern nur die Sortierung (siehe unten).
    minPrice = null;
    maxPrice = null;
  }

  if (minPrice !== null || maxPrice !== null) {
    const beforePriceFilter = candidates.length;
      candidates = candidates.filter((p) => {
      const price = p.price ?? 0;
      // TODO Vorschlag: Bei Budget-only Anfragen könnte man hier flexibler sein
      // (z. B. ±10% Toleranz), aktuell exakte Grenzen
      if (minPrice !== null && price < minPrice) return false;
      // WICHTIG: "über 500" wird aktuell als ">= 500" interpretiert (minPrice = 500, price >= 500)
      // In der Praxis ist das meist akzeptabel, technisch sollte "über" aber ">" sein.
      // TODO Vorschlag: Für "über X" könnte man minPrice + 0.01 verwenden, um strikt > zu erzwingen
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });
    
    console.log("[EFRO SB] AFTER PRICE FILTER", {
      text: text.substring(0, 80),
      minPrice,
      maxPrice,
      beforeCount: beforePriceFilter,
      afterCount: candidates.length,
      // Sample-Preise für Debugging
      samplePrices: candidates.slice(0, 5).map((p) => p.price ?? 0),
    });
  } else {
    console.log("[EFRO SB] PRICE FILTER SKIPPED", {
      text: text.substring(0, 80),
      reason: "no user price range",
      candidateCount: candidates.length,
    });
  }

  console.log("[EFRO Filter FALLBACK_INTENT]", {
    text,
    intent,
    candidateTitles: candidates.map((p) => p.title),
    minPrice,
    maxPrice,
    userMinPrice,
    userMaxPrice,
  });

  /**
   * 4) Fallback, wenn durch Filter alles weggefallen ist
   * WICHTIG: Bei Parfüm-Intent die Parfüm-Kandidaten NICHT überschreiben
   */
      if (candidates.length === 0) {
        // Bei Parfüm-Intent: Wenn Parfüm-Kandidaten existieren, diese beibehalten
        // (auch wenn sie durch Preisfilter leer wurden - besser als alle Produkte zu zeigen)
        if (hasPerfumeCandidates && originalPerfumeCandidates.length > 0) {
          candidates = originalPerfumeCandidates;
          console.log("[EFRO PerfumeFallback]", {
            text,
            note: "Parfüm-Kandidaten beibehalten trotz leerer candidates nach Filter",
            perfumeCount: candidates.length,
            sampleTitles: candidates.slice(0, 5).map((p) => p.title),
          });
        } else {
          // Normale Fallback-Logik für Nicht-Parfüm-Anfragen
        candidates = [...allProducts];

    if (matchedCategories.length > 0) {
      const byCat = candidates.filter((p) =>
        matchedCategories.includes(normalize(p.category || ""))
      );
      if (byCat.length > 0) {
        candidates = byCat;
      }
    }

    if (userMinPrice !== null || userMaxPrice !== null) {
      let tmp = candidates.filter((p) => {
        const price = p.price ?? 0;
        if (userMinPrice !== null && price < userMinPrice) return false;
        if (userMaxPrice !== null && price > userMaxPrice) return false;
        return true;
      });

      if (tmp.length > 0) {
        candidates = tmp;
            }
      }
    }
  }

  /**
   * 5) Sortierung abhängig von Budget & Intent
   */

  if (hasBudget) {
    if (userMinPrice !== null && userMaxPrice === null) {
      // nur Untergrenze: günstigste über X zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      // unter / zwischen X: teuer nach günstig
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
  } else {
    if (currentIntent === "premium") {
      // Premium: teuerste zuerst
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

      // Spezialfall: User will explizit das teuerste Produkt
      if (wantsMostExpensive && candidates.length > 1) {
        candidates = [candidates[0]];
      }

      // Debug-Log für Premium-Intent
      console.log("[EFRO PREMIUM_INTENT]", {
        text,
        intent: currentIntent,
        wantsMostExpensive,
        candidateCount: candidates.length,
      });
    } else if (
      currentIntent === "bargain" ||
      currentIntent === "gift" ||
      currentIntent === "quick_buy"
    ) {
      // Schnäppchen / Geschenk / Quick-Buy: günstigste zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (currentIntent === "explore") {
      candidates.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // Finales Log mit Produkt-Details
  const finalProducts = candidates.slice(0, 4);
  console.log("[EFRO SB] FINAL products", {
    text: text.substring(0, 80),
    intent: currentIntent,
    finalCount: finalProducts.length,
    products: finalProducts.map((p) => ({
      title: p.title.substring(0, 50),
      price: p.price ?? null,
      category: p.category ?? null,
    })),
  });

  return finalProducts;
}

/**
 * Ausschnitt aus der Produktbeschreibung
 */
function getDescriptionSnippet(
  description?: string | null,
  maxLength: number = 280
): string | null {
  if (!description) return null;

  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.slice(0, maxLength) + "…";
}

/**
 * Szenario-Typen für Profiseller-Reply-Engine
 */
type ProfisellerScenario =
  | "S1" // QUICK BUY – EIN klares Produkt
  | "S2" // QUICK BUY – WENIGE Optionen (2-4)
  | "S3" // EXPLORE – Mehrere Produkte (>= 3)
  | "S4" // BUDGET-ONLY ANFRAGE
  | "S5" // ONLY CATEGORY / MARKENANFRAGE
  | "S6" // ZERO RESULTS (kein unknown_product_code_only)
  | "fallback"; // Bestehendes Verhalten

/**
 * Erkennt das Profiseller-Szenario basierend auf Intent, Produktanzahl, Budget, etc.
 */
function detectProfisellerScenario(
  text: string,
  intent: ShoppingIntent,
  count: number,
  hasBudget: boolean,
  minPrice: number | null,
  maxPrice: number | null,
  attributeTerms: string[]
): ProfisellerScenario {
  // S6: ZERO RESULTS (wird bereits in buildRuleBasedReplyText behandelt, aber für Vollständigkeit)
  if (count === 0) {
    return "S6";
  }

  // S4: BUDGET-ONLY ANFRAGE
  // Erkennung: Budget vorhanden, aber wenig oder keine Keywords (nur Budget-Wörter)
  if (hasBudget) {
    const normalized = normalize(text);
    // Prüfe, ob der Text hauptsächlich Budget-Keywords enthält
    // Importiert aus languageRules.de.ts
    const hasOnlyBudgetKeywords = BUDGET_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw)) && 
                                   attributeTerms.length === 0 &&
                                   !BUDGET_ONLY_STOPWORDS.some(stopword => normalized.includes(stopword)) &&
                                   !PRODUCT_KEYWORDS_FOR_BUDGET_ONLY.some(kw => normalized.includes(kw));
    
    if (hasOnlyBudgetKeywords || (normalized.match(/\d+\s*(€|euro|eur)/) && attributeTerms.length === 0)) {
      return "S4";
    }
  }

  // S5: ONLY CATEGORY / MARKENANFRAGE
  // Erkennung: explore Intent, Produkte vorhanden, aber kein Budget
  if (intent === "explore" && !hasBudget && count > 0) {
    // Prüfe, ob hauptsächlich Kategorie/Marke genannt wurde
    const normalized = normalize(text);
    // Importiert aus languageRules.de.ts
    const hasCategoryKeyword = CATEGORY_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw));
    
    if (hasCategoryKeyword || (attributeTerms.length > 0 && !normalized.match(/\d+\s*(€|euro|eur)/))) {
      return "S5";
    }
  }

  // S1: QUICK BUY – EIN klares Produkt
  if (intent === "quick_buy" && count === 1) {
    return "S1";
  }

  // S2: QUICK BUY – WENIGE Optionen (2-4)
  if (intent === "quick_buy" && count >= 2 && count <= 4) {
    return "S2";
  }

  // S3: EXPLORE – Mehrere Produkte (>= 3)
  if (intent === "explore" && count >= 3) {
    return "S3";
  }

  // Fallback: Bestehendes Verhalten
  return "fallback";
}

/**
 * Regel-basierte Reply-Text-Generierung (Profiseller-Engine v1)
 */
function buildRuleBasedReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[],
  plan?: string
): string {
  const count = recommended.length;

  // S6: ZERO RESULTS wird hier behandelt, aber Szenario-Erkennung erfolgt später
  // (unknown_product_code_only wird bereits in buildReplyText behandelt)
  if (count === 0) {
    // S6-Text wird später im switch-case verwendet, hier nur Fallback
    return (
      "Zu deiner Anfrage konnte ich in diesem Shop leider nichts Passendes finden.\n\n" +
      "Wenn du möchtest, formuliere deine Anfrage noch einmal – z. B. mit Kategorie, Budget oder Einsatzzweck."
    );
  }

  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "–";

  const first = recommended[0];

  // Prüfe, ob User explizit nach dem teuersten Produkt fragt
  const wantsMostExpensive = detectMostExpensiveRequest(text);

  // Spezialfall: "Teuerstes Produkt" mit gefundenen Produkten
  if (wantsMostExpensive && count > 0) {
    const top = recommended[0];
    return [
      `Ich habe dir das teuerste Produkt aus dem Shop eingeblendet: "${top.title}".`,
      `Wenn du das Produkt anklickst, siehst du alle Details und den genauen Preis.`,
    ].join(" ");
  }

  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== null || maxPrice !== null;

  const explanationMode = detectExplanationMode(text);

  // Attribute-Terms aus Query extrahieren
  const parsed = parseQueryForAttributes(text);
  const { attributeTerms } = parsed;

  const descSnippet = getDescriptionSnippet(first.description);
  const hasDesc = !!descSnippet;

  let budgetText = "";
  if (hasBudget) {
    if (minPrice !== null && maxPrice === null) {
      budgetText = `ab etwa ${minPrice} €`;
    } else if (maxPrice !== null && minPrice === null) {
      budgetText = `bis etwa ${maxPrice} €`;
    } else if (minPrice !== null && maxPrice !== null) {
      budgetText = `zwischen ${minPrice} € und ${maxPrice} €`;
    }
  }

  const categoryLabel =
    first.category && first.category.trim().length > 0
      ? first.category
      : "dieses Produkts";
  const priceLabel = formatPrice(first);

  // Szenario-Erkennung für Profiseller-Engine
  const scenario = detectProfisellerScenario(
    text,
    intent,
    count,
    hasBudget,
    minPrice,
    maxPrice,
    attributeTerms
  );

  console.log("[EFRO Profiseller] scenario", {
    text: text.substring(0, 100),
    intent,
    finalCount: count,
    scenario,
    hasBudget,
    minPrice,
    maxPrice,
  });

  // 0) Spezialfälle: Erklär-Modus (hat Priorität vor Profiseller-Szenarien)
  if (explanationMode) {
    if (explanationMode === "ingredients") {
      if (hasDesc) {
        return (
          `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
          "Die exakte Liste der Inhaltsstoffe wird direkt im Shop auf der Produktseite gepflegt – dort findest du alle Details, inklusive gesetzlich vorgeschriebener Angaben.\n\n" +
          "In der aktuellen Produktbeschreibung steht unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Wenn du Allergien oder sehr empfindliche Haut hast, schau bitte auf der Produktseite im Bereich 'Inhaltsstoffe' nach oder kontaktiere direkt den Händler, bevor du das Produkt verwendest."
        );
      } else {
        return (
          `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
          "Die exakte Liste der Inhaltsstoffe wird direkt im Shop auf der Produktseite gepflegt – dort findest du alle Details, inklusive gesetzlich vorgeschriebener Angaben.\n\n" +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}" und liegt preislich bei ${priceLabel}. ` +
          "Wenn du Allergien oder sehr empfindliche Haut hast, schau bitte auf der Produktseite im Bereich 'Inhaltsstoffe' nach oder kontaktiere direkt den Händler, bevor du das Produkt verwendest."
        );
      }
    }

        if (explanationMode === "materials") {
      if (hasDesc) {
        return (
          `Du möchtest mehr über das Material von "${first.title}" wissen.\n\n` +
          "Die genaue Materialzusammensetzung (z. B. Baumwolle, Polyester, Mischgewebe) ist im Shop auf der Produktseite hinterlegt – dort findest du in der Regel einen Abschnitt wie 'Material' oder 'Produktdetails'.\n\n" +
          "In der aktuellen Produktbeschreibung findest du unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Für exakte Materialangaben und Prozentanteile nutze bitte die Produktseite."
        );
      } else {
        return (
          `Du möchtest mehr über das Material von "${first.title}" wissen.\n\n` +
          "Die genaue Materialzusammensetzung (z. B. Baumwolle, Polyester, Mischgewebe) ist im Shop auf der Produktseite hinterlegt – dort findest du in der Regel einen Abschnitt wie 'Material' oder 'Produktdetails'.\n\n" +
          `EFRO kann dir sagen: Es handelt sich um einen Artikel aus der Kategorie "${categoryLabel}" im Preisbereich ${priceLabel}. ` +
          "Für exakte Materialangaben und Prozentanteile nutze bitte die Produktseite."
        );
      }
    }


    if (explanationMode === "usage") {
      if (hasDesc) {
        return (
          `Du möchtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}". Die konkrete Anwendung wird normalerweise auf der Produktverpackung und auf der Produktseite im Shop beschrieben.\n\n` +
          "In der Produktbeschreibung steht zum Gebrauch unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Weitere Details und Sicherheitshinweise findest du auf der Produktseite im Shop."
        );
      } else {
        return (
          `Du möchtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}". Die konkrete Anwendung wird normalerweise auf der Produktverpackung und auf der Produktseite im Shop beschrieben.\n\n` +
          "Schau dir am besten die Hinweise zur Anwendung und Sicherheit auf der Produktseite an – dort findest du meist eine Schritt-für-Schritt-Erklärung. Wenn du mir sagst, wofür du es genau einsetzen willst, kann ich dir zusätzlich einen Tipp geben, worauf du besonders achten solltest."
        );
      }
    }

    if (explanationMode === "care" || explanationMode === "washing") {
      if (hasDesc) {
        return (
          `Du fragst nach Pflege- oder Waschhinweisen für "${first.title}".\n\n` +
          `Als Artikel aus der Kategorie "${categoryLabel}" gelten in der Regel die Pflegehinweise, die auf dem Etikett bzw. auf der Produktseite stehen. Dort findest du zum Beispiel Symbole zu Waschtemperatur, Trockner-Eignung oder Handwäsche.\n\n` +
          "In der Produktbeschreibung sind Pflegehinweise erwähnt, z. B.:\n" +
          descSnippet +
          "\n\n" +
          "Bitte richte dich bei der Pflege immer nach den offiziellen Angaben auf dem Produktlabel bzw. in der Produktbeschreibung im Shop."
        );
      } else {
        return (
          `Du fragst nach Pflege- oder Waschhinweisen für "${first.title}".\n\n` +
          `Als Artikel aus der Kategorie "${categoryLabel}" gelten in der Regel die Pflegehinweise, die auf dem Etikett bzw. auf der Produktseite stehen. Dort findest du zum Beispiel Symbole zu Waschtemperatur, Trockner-Eignung oder Handwäsche.\n\n` +
          "Bitte richte dich bei der Pflege immer nach den offiziellen Angaben auf dem Produktlabel bzw. in der Produktbeschreibung im Shop."
        );
      }
    }
  }

  /**
   * Profiseller-Szenarien S1-S6
   */
  switch (scenario) {
    case "S1": {
      // QUICK BUY – EIN klares Produkt
      const priceInfo = first.price != null ? ` – ${formatPrice(first)}` : "";
      return (
        "Ich habe ein passendes Produkt für dich gefunden:\n\n" +
        `• ${first.title}${priceInfo}\n\n` +
        "Wenn du möchtest, helfe ich dir beim Vergleichen oder wir suchen eine Alternative."
      );
    }

    case "S2": {
      // QUICK BUY – WENIGE Optionen (2-4)
      const priceRange = (() => {
        const prices = recommended
          .map((p) => p.price)
          .filter((p): p is number => p != null);
        if (prices.length === 0) return null;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return `${min.toFixed(2)} €`;
        return `${min.toFixed(2)} € – ${max.toFixed(2)} €`;
      })();

      const priceInfo = priceRange ? ` (Preisbereich: ${priceRange})` : "";
      const topProducts = recommended.slice(0, 3).map((p) => {
        const price = p.price != null ? ` – ${formatPrice(p)}` : "";
        return `• ${p.title}${price}`;
      });

      return (
        "Ich habe mehrere passende Produkte für dich gefunden:\n\n" +
        topProducts.join("\n") +
        (recommended.length > 3 ? `\n• ... und ${recommended.length - 3} weitere` : "") +
        priceInfo +
        "\n\nWorauf legst du am meisten Wert – Preis, Marke oder Einsatzgebiet?"
      );
    }

    case "S3": {
      // EXPLORE – Mehrere Produkte (>= 3)
      return (
        "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet.\n\n" +
        "• Du kannst dir in Ruhe die Details und Preise ansehen.\n" +
        "• Wenn du willst, grenze ich das für dich nach Preisbereich, Kategorie oder Einsatzzweck ein.\n\n" +
        "Was ist dir wichtiger: ein günstiger Preis oder eine bestimmte Marke?"
      );
    }

    case "S4": {
      // BUDGET-ONLY ANFRAGE
      const budgetDisplay = budgetText || (maxPrice ? `bis etwa ${maxPrice} €` : minPrice ? `ab etwa ${minPrice} €` : "");
      return (
        `Mit deinem Budget von ${budgetDisplay} habe ich dir unten passende Produkte eingeblendet.\n\n` +
        "Wenn du mir noch sagst, für welchen Bereich (z. B. Haushalt, Pflege, Tierbedarf), kann ich die Auswahl weiter eingrenzen."
      );
    }

    case "S5": {
      // ONLY CATEGORY / MARKENANFRAGE
      const categoryName = first.category && first.category.trim().length > 0
        ? first.category
        : "diesem Bereich";
      return (
        "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet.\n\n" +
        `Alle Produkte gehören in den Bereich ${categoryName}.\n\n` +
        "Möchtest du eher etwas Günstiges für den Alltag oder eher eine Premiumnote?"
      );
    }

    case "S6": {
      // ZERO RESULTS (kein unknown_product_code_only)
      return (
        "Zu deiner Anfrage konnte ich in diesem Shop leider nichts Passendes finden.\n\n" +
        "Wenn du möchtest, formuliere deine Anfrage noch einmal – z. B. mit Kategorie, Budget oder Einsatzzweck."
      );
    }

    case "fallback":
    default: {
      // Bestehendes Verhalten für alle anderen Fälle
      break;
    }
  }

  /**
   * 1) Fälle mit explizitem Budget im Text (Fallback, wenn nicht S4)
   */
  if (hasBudget && scenario === "fallback") {
    if (count === 1) {
      return (
        `Ich habe ein Produkt gefunden, das gut zu deinem Budget ${budgetText} passt:\n\n` +
        `• ${first.title} – ${formatPrice(first)}\n\n` +
        "Wenn du möchtest, kann ich dir noch eine Alternative im ähnlichen Preisbereich zeigen."
      );
    }

    const intro =
      `Ich habe mehrere Produkte passend zu deinem Budget ${budgetText} gefunden.\n` +
      `Ein sehr gutes Match ist:\n\n` +
      `• ${first.title} – ${formatPrice(first)}\n\n` +
      "Zusätzlich habe ich dir unten noch weitere passende Produkte eingeblendet:";

  const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );

    const closing =
      "\n\nWenn du dein Budget anpassen möchtest (zum Beispiel etwas höher oder niedriger), sag mir einfach kurz Bescheid.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 2) Premium-Intent ohne Budget
   */
  if (intent === "premium") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint =
        ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const qualityHint =
      " Ich habe Produkte ausgewählt, bei denen Qualität im Vordergrund steht.";

    if (count === 1) {
      return (
        "Ich habe ein hochwertiges Premium-Produkt für dich gefunden:\n\n" +
        `• ${first.title}\n\n` +
        (attributeHint || qualityHint) +
        " Das ist eine sehr gute Wahl, wenn dir Qualität wichtiger ist als der letzte Euro im Preis. " +
        "Wenn du möchtest, kann ich dir noch eine etwas günstigere Alternative zeigen."
      );
    }

    const intro =
      "Ich habe dir eine Auswahl an hochwertigen Premium-Produkten zusammengestellt." +
      (attributeHint || qualityHint) +
      " Ein besonders starkes Match ist:";

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      '\n\nWenn du lieber in einem bestimmten Preisbereich bleiben möchtest, sag mir einfach dein Budget (z. B. "unter 500 Euro").';

    return [intro, "", `• ${first.title}`, "", ...lines, closing].join("\n");
  }

  /**
   * 3) Bargain-Intent ohne Budget
   */
  if (intent === "bargain") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const priceHint =
      " Ich habe auf ein gutes Preis-Leistungs-Verhältnis geachtet.";

    const intro =
      "Ich habe dir besonders preiswerte Produkte herausgesucht." +
      (attributeHint || priceHint);
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      "\n\nWenn du mir dein maximales Budget nennst, kann ich noch genauer eingrenzen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 4) Geschenk-Intent
   */
  if (intent === "gift") {
    const intro =
      "Ich habe dir ein paar passende Geschenkideen zusammengestellt:";
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      "\n\nSag mir gerne, für wen das Geschenk ist – dann kann ich noch gezielter empfehlen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 5) Standard-Fälle (explore / quick_buy / bundle ...)
   */
  if (count === 1) {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    return (
      "Ich habe ein passendes Produkt für dich gefunden:\n\n" +
      `• ${first.title}${attributeHint}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  let attributeHint = "";
  if (attributeTerms.length > 0) {
    attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
  }

  const intro =
    "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:" +
    attributeHint;
  const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
  const closing =
    "\n\nWenn du möchtest, helfe ich dir jetzt beim Eingrenzen – zum Beispiel nach Preisbereich, Kategorie oder Einsatzzweck.";

  return [intro, "", ...lines, closing].join("\n");
}

/**
 * AI-Klärungstexte basierend auf aiTrigger hinzufügen
 */
function buildReplyTextWithAiClarification(
  baseReplyText: string,
  aiTrigger?: SellerBrainAiTrigger,
  finalCount?: number
): string {
  if (!aiTrigger || !aiTrigger.needsAiHelp) {
    return baseReplyText;
  }

  const terms = (aiTrigger.unknownTerms ?? []).filter(Boolean);
  const termsSnippet = terms.length ? ` ${terms.join(", ")}` : "";

  let clarification = "";

  if (aiTrigger.reason === "no_results") {
    clarification = terms.length
      ? `\n\nIch finde zu folgendem Begriff nichts im Katalog:${termsSnippet}. Meinst du eine bestimmte Marke, Kategorie oder etwas anderes?`
      : `\n\nIch habe zu deiner Beschreibung keine passenden Produkte gefunden. Magst du dein Anliegen noch einmal anders formulieren oder eine Kategorie bzw. ein Budget nennen?`;
  } else {
    clarification = terms.length
      ? `\n\nEinige deiner Begriffe kann ich im Katalog nicht zuordnen:${termsSnippet}. Meinst du eher eine Marke, eine Kategorie oder ein bestimmtes Einsatzgebiet?`
      : `\n\nEin Teil deiner Anfrage ist für mich schwer zuzuordnen. Magst du mir noch sagen, ob es eher um eine Marke, eine Kategorie oder einen Einsatzbereich geht?`;
  }

  // Optional: Wenn wirklich gar keine Produkte gefunden wurden,
  // kannst du den Basetext später kürzen. Für jetzt hängen wir
  // nur die Klärung sauber an.
  const combined = `${baseReplyText.trim()}\n\n${clarification.trim()}`;

  console.log("[EFRO ReplyText AI-Clarify]", {
    reason: aiTrigger.reason,
    needsAiHelp: aiTrigger.needsAiHelp,
    unknownTerms: aiTrigger.unknownTerms,
    finalReplyText: combined,
  });

  return combined;
}

/**
 * Reply-Text für EFRO bauen
 */
function buildReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[],
  aiTrigger?: SellerBrainAiTrigger
): string {
  console.log("[EFRO ReplyText] mode='rule-based'", {
    intent,
    recommendedCount: recommended.length,
  });

  // Spezialfall: Nutzer nennt einen unbekannten Produktcode wie "ABC123"
  if (aiTrigger?.reason === "unknown_product_code_only") {
    const codeTerm =
      aiTrigger.codeTerm ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms.find((t) => looksLikeProductCode(t))) ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms[0]) ||
      null;

    const codeLabel = codeTerm ? `"${codeTerm}"` : "diesen Code";

    const clarifyText =
      `Ich konnte den Code ${codeLabel} in diesem Shop nicht finden.\n\n` +
      `Sag mir bitte, was für ein Produkt du suchst – zum Beispiel eine Kategorie (Haushalt, Pflege, Tierbedarf), ` +
      `eine Marke oder ein bestimmtes Einsatzgebiet.\n` +
      `Dann zeige ich dir gezielt passende Produkte.`;

    console.log("[EFRO ReplyText UnknownCode]", {
      reason: aiTrigger.reason,
      codeTerm,
      clarifyTextLength: clarifyText.length,
    });

    return clarifyText;
  }

  // Regel-basierte Logik
  const baseReplyText = buildRuleBasedReplyText(text, intent, recommended);

  // AI-Klärung hinzufügen, falls nötig
  const finalReplyText = buildReplyTextWithAiClarification(
    baseReplyText,
    aiTrigger,
    recommended.length
  );

  return finalReplyText;
}

/**
 * Prüft, ob ein Begriff wie ein Produktcode aussieht (z. B. ABC123 oder ABCDFG)
 * WICHTIG: Reine Zahlen werden NICHT als Code akzeptiert
 */
function looksLikeProductCode(term: string): boolean {
  const t = term.toLowerCase().trim();
  if (t.length < 4 || t.length > 20) return false;
  
  // Numeric-only Tokens ignorieren (z. B. "50", "21", "22")
  if (/^[0-9]+$/.test(t)) return false;
  
  // Mischung aus Buchstaben und Zahlen (z. B. ABC123)
  const hasLetter = /[a-z]/i.test(t);
  const hasDigit = /\d/.test(t);
  if (hasLetter && hasDigit) return true;
  
  // Reine Buchstabencodes (z. B. ABCDFG) - mindestens 4 Zeichen, hauptsächlich Buchstaben
  const isMostlyLetters = /^[a-z]+$/i.test(t);
  if (isMostlyLetters && t.length >= 4) return true;
  
  return false;
}

// Häufige Wörter, die KEIN Produktcode sind, auch wenn sie Buchstaben/Zahlen enthalten könnten
const NON_CODE_TERMS_SET = new Set(NON_CODE_TERMS_ARRAY);

// Stopwörter für AI-Unknown-Terms-Filterung
// Diese Wörter sollen NICHT als "unbekannte Begriffe" für AI-Trigger zählen
const UNKNOWN_AI_STOPWORDS_SET = new Set<string>(UNKNOWN_AI_STOPWORDS_ARRAY);

// Extrahiert einen einzelnen Code-ähnlichen Term aus dem Nutzersatz
// Erkennt sowohl gemischte Codes (ABC123) als auch reine Buchstabencodes (ABCDFG)
function extractCodeTermFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Schritt 1: Einfache Wort-Splittung für gemischte Codes (ABC123)
  const candidates = lower.match(/\b[a-z0-9\-]{4,20}\b/gi);
  if (!candidates) return null;

  const codeCandidates = candidates.filter((c) => {
    const trimmed = c.toLowerCase();
    if (NON_CODE_TERMS_SET.has(trimmed)) return false;
    return looksLikeProductCode(trimmed);
  });

  if (codeCandidates.length === 1) {
    return codeCandidates[0];
  }

  // Schritt 2: Für reine Buchstabencodes (ABCDFG) - isolierte unbekannte Terms prüfen
  // Extrahiere alle Terms nach Entfernen von Stoppwörtern
  const stopwords = new Set([
    "kannst", "du", "mir", "zeigen", "zeige", "zeig", "bitte", "ich", "suche", "ein", "eine", "einen",
    "produkt", "produkte", "artikel", "kann", "können", "soll", "sollte", "möchte", "will", "würde",
    // Personalpronomen
    "er", "sie", "wir", "ihr",
    // Verben (haben)
    "habe", "hast", "hat", "haben",
    // Budget/Preis-Wörter
    "budget", "preis", "euro", "unter", "über", "bis", "ca", "etwa", "ungefähr", "von",
  ]);
  
  const normalized = normalize(text);
  const allTerms = normalized
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !stopwords.has(t.toLowerCase()))
    .filter((t) => !NON_CODE_TERMS_SET.has(t.toLowerCase()))
    // Numeric-only Tokens ignorieren
    .filter((t) => !/^[0-9]+$/.test(t));

  // Wenn genau 1 Term übrig bleibt und dieser wie ein Code aussieht
  if (allTerms.length === 1) {
    const singleTerm = allTerms[0];
    if (looksLikeProductCode(singleTerm)) {
      return singleTerm;
    }
  }

  return null;
}

/**
 * Hauptfunktion, die vom Chat/Avatar aufgerufen wird
 */
export function runSellerBrain(
  userText: string,
  currentIntent: ShoppingIntent,
  allProducts: EfroProduct[],
  plan?: string,
  previousRecommended?: EfroProduct[],
  context?: SellerBrainContext
): SellerBrainResult {
  const raw = userText ?? "";
  const cleaned = raw.trim();

  // Defensive Guard: Leere Produktliste
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    console.warn("[EFRO SB] Empty product list", {
      userText: cleaned.substring(0, 100),
      allProductsType: typeof allProducts,
      allProductsLength: Array.isArray(allProducts) ? allProducts.length : "not an array",
    });

    const fallbackReplyText =
      "Entschuldigung, im Moment sind keine Produkte verfügbar. Bitte versuche es später noch einmal.";

    return {
      intent: currentIntent,
      recommended: [],
      replyText: fallbackReplyText,
      nextContext: context,
      aiTrigger: {
        needsAiHelp: true,
        reason: "no_results",
        unknownTerms: [],
      },
    };
  }

  const nextIntent = detectIntentFromText(cleaned, currentIntent);

  console.log("[EFRO SB Context] Incoming context", {
    activeCategorySlug: context?.activeCategorySlug ?? null,
  });

  console.log("[EFRO SB] ENTER runSellerBrain", {
    userText: cleaned.substring(0, 100),
    currentIntent,
    nextIntent,
    totalProducts: allProducts.length,
    plan,
    previousRecommendedCount: previousRecommended?.length ?? 0,
  });

  // Plan-Logik: starter = 2, pro = 4, enterprise = 6, default = 4
  const getMaxRecommendationsForPlan = (p?: string): number => {
    const normalized = (p ?? "").toLowerCase();
    if (normalized === "starter") return 2;
    if (normalized === "pro") return 4;
    if (normalized === "enterprise") return 6;
    return 4;
  };

  const maxRecommendations = getMaxRecommendationsForPlan(plan);

  const explanationMode = detectExplanationMode(cleaned);
  console.log("[EFRO SellerBrain] explanationMode", {
    text: cleaned,
    explanationMode,
    previousCount: previousRecommended ? previousRecommended.length : 0,
  });

  // Erklärung zuerst, aber ohne neue Produktauswahl
  if (explanationMode) {
    const recommended = previousRecommended
      ? previousRecommended.slice(0, maxRecommendations)
      : [];

    // AI-Trigger wird hier noch nicht berechnet (explanation mode), daher undefined
    const replyText =
      recommended.length > 0
        ? buildReplyText(cleaned, nextIntent, recommended, undefined)
        : "Ich kann dir gerne Fragen zu Inhaltsstoffen, Anwendung oder Pflege beantworten. " +
          "Dafür brauche ich aber ein konkretes Produkt. Bitte sage mir zuerst, welches Produkt dich interessiert, " +
          "dann kann ich dir die Details dazu erklären.";

    console.log("[EFRO SellerBrain] Explanation mode – no new filtering", {
      text: cleaned,
      explanationMode,
      previousCount: previousRecommended ? previousRecommended.length : 0,
      usedCount: recommended.length,
      maxRecommendations,
    });

  return {
    intent: nextIntent,
    recommended,
    replyText,
  };
  }

  // OFF-TOPIC-GUARD
  if (!isProductRelated(cleaned)) {
    const recommended = previousRecommended
      ? previousRecommended.slice(0, maxRecommendations)
      : [];

    const offTopicReply =
      "Ich bin hier, um dir bei der Produktsuche zu helfen. Stell mir bitte Fragen zu Produkten aus dem Shop.";

    console.log("[EFRO SellerBrain] Off-topic detected, no new filtering", {
      text: cleaned,
      previousCount: previousRecommended ? previousRecommended.length : 0,
      usedCount: recommended.length,
    });

    return {
      intent: nextIntent,
      recommended,
      replyText: offTopicReply,
    };
  }

  // Normale Such-/Kaufanfrage -> filtern
  const filterResult = filterProducts(cleaned, nextIntent, allProducts, context?.activeCategorySlug);
  const candidateCount = filterResult.length;
  
  console.log("[EFRO SB] AFTER filterProducts", {
    userText: cleaned.substring(0, 100),
    intent: nextIntent,
    candidateCount,
    sampleTitles: filterResult.slice(0, 3).map((p) => p.title),
  });
  
  // NEU: Schimmel-Only-Filter
  const moldQuery = isMoldQuery(cleaned);
  let finalRanked = filterResult;
  
  if (moldQuery) {
    const moldOnly = filterResult.filter((p) => isMoldProduct(p));
    
    if (moldOnly.length > 0) {
      finalRanked = moldOnly;
      
      console.log("[EFRO MoldOnly Filter]", {
        userText: cleaned,
        moldCount: moldOnly.length,
        titles: moldOnly.map((p) => p.title),
      });
    }
  }
  
  // Budget-only-Query: Maximal 2 günstigste Produkte
  const { minPrice, maxPrice } = extractUserPriceRange(cleaned);
  const hasBudget = minPrice !== null || maxPrice !== null;
  
  // Erkennung: Budget vorhanden, aber hauptsächlich nur Budget-Keywords (keine Produkt-Keywords)
  const isBudgetOnly = hasBudget && (() => {
    const normalized = normalize(cleaned);
    // Importiert aus languageRules.de.ts
    const hasBudgetKeyword = BUDGET_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw));
    const parsed = parseQueryForAttributes(cleaned);
    // Keine Attribute-Terms und keine Produkt-Keywords außer Budget-Wörter
    // Importiert aus languageRules.de.ts
    const hasProductKeyword = PRODUCT_KEYWORDS_FOR_BUDGET_ONLY.some(kw => normalized.includes(kw));
    const hasOnlyBudgetKeywords = hasBudgetKeyword && parsed.attributeTerms.length === 0 && !hasProductKeyword;
    return hasOnlyBudgetKeywords || (normalized.match(/\d+\s*(€|euro|eur)/) && parsed.attributeTerms.length === 0 && !hasProductKeyword);
  })();
  
  if (isBudgetOnly && finalRanked.length > 2) {
    // Sortiere nach Preis (günstigste zuerst) und nehme die 2 günstigsten
    const sortedByPrice = [...finalRanked].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    finalRanked = sortedByPrice.slice(0, 2);
    
    console.log("[EFRO SB Budget-Only] Limited to 2 cheapest products", {
      userText: cleaned.substring(0, 100),
      originalCount: filterResult.length,
      finalCount: finalRanked.length,
      selectedProducts: finalRanked.map((p) => ({
        title: p.title.substring(0, 50),
        price: p.price ?? null,
      })),
    });
  }
  
  // Bei Schimmel-Anfragen maximal 1 Produkt zeigen (Hero-Produkt)
  // Bei Budget-only maximal 2 Produkte (bereits oben begrenzt)
  const effectiveMaxRecommendations = moldQuery
    ? Math.min(1, maxRecommendations ?? 1)
    : isBudgetOnly
    ? Math.min(2, maxRecommendations ?? 2)
    : maxRecommendations;
  
  let recommended = finalRanked.slice(0, effectiveMaxRecommendations);

  // Force-Show-Logik: Bei klaren Produktanfragen immer Produkte anzeigen
  const forceShowProducts =
    nextIntent === "quick_buy" &&
    isProductRelated(cleaned) &&
    candidateCount > 0;

  let reusedPreviousProducts = false;

  const normalized = normalize(cleaned || "");

  const offTopicKeywords = [
    "politik",
    "wahl",
    "regierung",
    "krieg",
    "nachrichten",
    "cursor",
    "token",
    "ki",
    "chatgpt",
    "abo",
    "abonnement",
    "vertrag",
    "versicherung",
  ];

  const isOffTopic = offTopicKeywords.some((word) =>
    normalized.includes(word)
  );

  let replyText: string;

  if (isOffTopic) {
    // Nur leeren, wenn nicht forceShowProducts aktiv ist
    if (!forceShowProducts) {
      recommended = [];
    }
    replyText =
      "Ich bin EFRO und helfe dir nur bei Fragen zu Produkten aus diesem Shop. " +
      "Frag mich z. B. nach Kategorien, Preisen, Größen, Materialien oder bestimmten Artikeln – " +
      "dann zeige ich dir passende Produkte.";
  } else {
    // AI-Trigger wird später berechnet, hier noch undefined
    replyText = buildReplyText(cleaned, nextIntent, recommended, undefined);
  }

  // Force-Show-Logik nach allen Guards: Wenn Produkte gefunden wurden, aber recommended leer ist
  if (forceShowProducts && recommended.length === 0 && candidateCount > 0) {
    recommended = finalRanked.slice(0, effectiveMaxRecommendations);
    console.log("[EFRO SellerBrain FORCE_PRODUCTS]", {
      text: cleaned,
      intent: nextIntent,
      candidateCount,
      usedCount: recommended.length,
    });
    // Reply-Text neu generieren, wenn noch nicht gesetzt
    // AI-Trigger wird später berechnet, hier noch undefined
    if (!replyText || replyText.includes("helfe dir nur")) {
      replyText = buildReplyText(cleaned, nextIntent, recommended, undefined);
    }
  }

  console.log("[EFRO SB] BEFORE REPLY_TEXT", {
    userText: cleaned.substring(0, 100),
    intent: nextIntent,
    plan,
    maxRecommendations,
    recommendedCount: recommended.length,
    totalProducts: allProducts.length,
    explanationMode: explanationMode ?? null,
  });

  console.log("[EFRO SB] FINAL PRODUCTS", {
    text: cleaned.substring(0, 100),
    intent: nextIntent,
    finalCount: recommended.length,
    products: recommended.map((p) => ({
      title: p.title.substring(0, 60),
      price: p.price ?? null,
      category: p.category ?? null,
    })),
  });

  // AI-Trigger: Analysiere, ob zusätzliche AI-Hilfe sinnvoll wäre
  // Analysiere Query erneut, um unknownTerms und coreTerms zu bekommen
  const parsedForAi = parseQueryForAttributes(cleaned);
  const { coreTerms: aiCoreTerms } = parsedForAi;

  // Baue Katalog-Keywords-Set für Alias-Analyse
  const catalogKeywordsSetForAlias = new Set<string>();
  for (const product of allProducts) {
    const titleWords = normalizeText(product.title || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    titleWords.forEach((w) => catalogKeywordsSetForAlias.add(w));

    const descWords = normalizeText(product.description || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    descWords.forEach((w) => catalogKeywordsSetForAlias.add(w));
  }
  
  // Prüfe, ob ein erfolgreicher AliasMatch vorhanden war
  // (wird später in CodeDetect verwendet, um zu verhindern, dass Produkte verworfen werden)
  const aliasMap = initializeAliasMap(Array.from(catalogKeywordsSetForAlias));
  const aliasCheckResult = resolveUnknownTerms(cleaned, Array.from(catalogKeywordsSetForAlias), aliasMap);
  const aliasMatchSuccessful = aliasCheckResult.aliasMapUsed && candidateCount > 0;
  const candidateCountAfterAlias = candidateCount;
  
  console.log("[EFRO SB AliasCheck]", {
    userText: cleaned.substring(0, 100),
    aliasMapUsed: aliasCheckResult.aliasMapUsed,
    aliasResolved: aliasCheckResult.resolved,
    aliasMatchSuccessful,
    candidateCountAfterAlias,
  });

  // Analysiere unbekannte Begriffe
  const normalizedText = normalize(cleaned);
  const stopwords = [
    "für", "mit", "und", "oder", "der", "die", "das", "ein", "eine", "einen",
    "mir", "mich", "dir", "dich", "ihm", "ihr", "uns", "euch", "ihnen",
    "zeige", "zeig", "zeigen", "zeigst", "zeigt", "zeigten", "gezeigt",
    "habe", "hast", "hat", "haben", "hatte", "hattest", "hatten",
    "bin", "bist", "ist", "sind", "war", "warst", "waren",
    "kann", "kannst", "können", "konnte", "konntest", "konnten",
    "will", "willst", "wollen", "wollte", "wolltest", "wollten",
    "soll", "sollst", "sollen", "sollte", "solltest", "sollten",
    "muss", "musst", "müssen", "musste", "musstest", "mussten",
    "darf", "darfst", "dürfen", "durfte", "durftest", "durften",
  ];
  const stopwordsSet = new Set(stopwords.map((w) => normalizeText(w)));
  
  // Baue Katalog-Keywords-Set für AI-Trigger-Analyse
  const catalogKeywordsSet = new Set<string>();
  for (const product of allProducts) {
    const titleWords = normalizeText(product.title || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    titleWords.forEach((w) => catalogKeywordsSet.add(w));

    const descWords = normalizeText(product.description || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    descWords.forEach((w) => catalogKeywordsSet.add(w));
  }
  
  const words = normalizedText
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !stopwordsSet.has(normalizeText(w)));

  const unknownTermsSet = new Set<string>();
  for (const word of words) {
    if (!catalogKeywordsSet.has(word)) {
      unknownTermsSet.add(word);
    }
  }

  const unknownTermsFromAnalysis = Array.from(unknownTermsSet);

  // Heuristiken für AI-Trigger
  const aiUnknownTerms: string[] = [];

  if (unknownTermsFromAnalysis && unknownTermsFromAnalysis.length > 0) {
    aiUnknownTerms.push(...unknownTermsFromAnalysis);
  }

  // Basiswerte für Heuristik
  const finalCount = recommended.length;
  const unknownCount = aiUnknownTerms.length;

  // ---------------------------------------------
  // Spezieller Check: Nutzer nennt nur einen Produktcode wie "ABC123"
  // -> Falls dieser Code im Katalog NICHT vorkommt, behandeln wir es
  //    als "unknown_product_code_only" und zeigen KEINE Produkte an.
  // WICHTIG: Budget-Only-Queries dürfen NIE als unknown_product_code_only behandelt werden.
  // WICHTIG: Kategorie-Codes (z.B. "snowboards" bei Kategorie "snowboard") dürfen NIE als unknown_product_code_only behandelt werden.
  // ---------------------------------------------
  
  // Kategorie-Informationen berechnen (ähnlich wie in filterProducts)
  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => normalize(p.category || ""))
        .filter((c) => c.length >= 3)
    )
  );
  
  const categoryHintsInText: string[] = [];
  const matchedCategories: string[] = [];
  const t = normalize(cleaned);
  
  const catRegex = /kategorie\s+([a-zäöüß]+)/;
  const catMatch = t.match(catRegex);
  if (catMatch && catMatch[1]) {
    const catWord = catMatch[1];
    categoryHintsInText.push(catWord);
    allCategories.forEach((cat) => {
      if (cat.includes(catWord)) {
        matchedCategories.push(cat);
      }
    });
  } else {
    allCategories.forEach((cat) => {
      if (cat && t.includes(cat)) {
        matchedCategories.push(cat);
        categoryHintsInText.push(cat);
      }
    });
  }
  
  // Effective Category Slug bestimmen (aus Text oder Kontext)
  let effectiveCategorySlugForCodeDetect: string | null = null;
  if (matchedCategories.length > 0) {
    effectiveCategorySlugForCodeDetect = matchedCategories[0];
  } else if (context?.activeCategorySlug) {
    effectiveCategorySlugForCodeDetect = normalize(context.activeCategorySlug);
  } else if (recommended.length > 0 && recommended[0].category) {
    effectiveCategorySlugForCodeDetect = normalize(recommended[0].category);
  }
  
  // Budget-Wort-Erkennung für zusätzliche Sicherheit (wird bereits oben berechnet, hier wiederverwenden)
  // Verwende die bereits oben berechneten Variablen: hasBudget, isBudgetOnly
  const originalForBudget = cleaned.toLowerCase();
  // Importiert aus languageRules.de.ts
  const hasBudgetWord =
    BUDGET_WORD_PATTERNS.some((pattern) => originalForBudget.includes(pattern)) ||
    /\b(budget|preis|maximal|max|höchstens|hoechstens|nicht mehr als|unter|bis)\b/i.test(cleaned);

  let unknownProductCodeOnly = false;
  let detectedCodeTerm: string | null = null;

  try {
    detectedCodeTerm = extractCodeTermFromText(cleaned);
  } catch (e) {
    console.warn("[EFRO CodeDetect] Fehler bei extractCodeTermFromText", e);
  }

  if (detectedCodeTerm) {
    const codeLc = detectedCodeTerm.toLowerCase();

    // Prüfen, ob dieser Code irgendwo im Katalog vorkommt
    const productCodeExistsInCatalog = allProducts.some((p) => {
      const fields: string[] = [];
      if (typeof (p as any).sku === "string") fields.push((p as any).sku);
      if (typeof (p as any).title === "string") fields.push((p as any).title);
      if (typeof (p as any).handle === "string") fields.push((p as any).handle);
      if (typeof (p as any).category === "string") fields.push((p as any).category);
      if (typeof (p as any).description === "string") fields.push((p as any).description);
      if (Array.isArray((p as any).tags)) {
        fields.push((p as any).tags.join(" "));
      }

      return fields.some((f) => f.toLowerCase().includes(codeLc));
    });

    // Hilfsflags für CodeDetect
    const hasRecommendations = finalCount > 0;
    const hasEffectiveCategory =
      !!effectiveCategorySlugForCodeDetect ||
      (matchedCategories && matchedCategories.length > 0) ||
      (categoryHintsInText && categoryHintsInText.length > 0);
    
    const isLikelyCategoryCodeTerm =
      !!detectedCodeTerm &&
      !!effectiveCategorySlugForCodeDetect &&
      (detectedCodeTerm.toLowerCase().includes(effectiveCategorySlugForCodeDetect) ||
       effectiveCategorySlugForCodeDetect.includes(detectedCodeTerm.toLowerCase()));

    // WICHTIG: Budget-Only-Queries dürfen NIE als unknown_product_code_only behandelt werden
    // Verwende die bereits oben berechneten Variablen hasBudgetWord und isBudgetOnly
    if (hasBudgetWord || isBudgetOnly) {
      // Budget-Only-Query erkannt → unknownProductCodeOnly NICHT setzen
      unknownProductCodeOnly = false;
      console.log("[EFRO CodeDetect] Budget-Only-Query erkannt, CodeDetect blockiert", {
        text: cleaned,
        detectedCodeTerm,
        hasBudgetWord,
        isBudgetOnly,
        hasBudget,
        productCodeExistsInCatalog,
        note: "Budget-Only-Queries werden nicht als unknown_product_code_only behandelt",
      });
    } else if (aliasMatchSuccessful && candidateCountAfterAlias > 0) {
      // WICHTIG: Wenn ein erfolgreicher AliasMatch vorhanden ist, dürfen diese Produkte NICHT verworfen werden
      unknownProductCodeOnly = false;
      console.log("[EFRO CodeDetect] AliasMatch erfolgreich, CodeDetect blockiert", {
        text: cleaned,
        detectedCodeTerm,
        aliasMatchSuccessful,
        candidateCountAfterAlias,
        productCodeExistsInCatalog,
        aliasResolved: aliasCheckResult.resolved,
        note: "Erfolgreiche AliasMatches werden nicht als unknown_product_code_only behandelt",
      });
    } else {
      unknownProductCodeOnly = !productCodeExistsInCatalog;
      
      // 1.2) Unknown-Code-Flag korrigieren: Kategorie-Codes ignorieren
      if (isLikelyCategoryCodeTerm) {
        // z. B. "snowboards" bei Kategorie-Slug "snowboard"
        unknownProductCodeOnly = false;
        console.log("[EFRO CodeDetect] Kategorie-Code erkannt, CodeDetect blockiert", {
          text: cleaned,
          detectedCodeTerm,
          effectiveCategorySlug: effectiveCategorySlugForCodeDetect,
          isLikelyCategoryCodeTerm,
          productCodeExistsInCatalog,
          note: "Kategorie-Codes werden nicht als unknown_product_code_only behandelt",
        });
      }
      
      console.log("[EFRO CodeDetect]", {
        text: cleaned,
        detectedCodeTerm,
        productCodeExistsInCatalog,
        unknownProductCodeOnly,
        hasRecommendations,
        hasEffectiveCategory,
        effectiveCategorySlug: effectiveCategorySlugForCodeDetect,
        isLikelyCategoryCodeTerm,
        aliasMatchSuccessful,
        candidateCountAfterAlias,
        note: unknownProductCodeOnly 
          ? "Code erkannt, aber nicht im Katalog gefunden → unknownProductCodeOnly = true"
          : "Code erkannt, aber blockiert (Kategorie/Alias/Budget)",
      });
    }

    if (unknownProductCodeOnly) {
      // In diesem Fall wollen wir KEINE Produktkarten anzeigen
      // WICHTIG: Nur wenn KEIN erfolgreicher AliasMatch vorhanden ist
      if (!aliasMatchSuccessful || candidateCountAfterAlias === 0) {
        recommended = [];
        console.log("[EFRO CodeDetect] Produkte verworfen (unknownProductCodeOnly = true)", {
          text: cleaned,
          detectedCodeTerm,
          aliasMatchSuccessful,
          candidateCountAfterAlias,
          recommendedCountBefore: recommended.length,
        });
      } else {
        console.log("[EFRO CodeDetect] Produkte NICHT verworfen (AliasMatch erfolgreich)", {
          text: cleaned,
          detectedCodeTerm,
          aliasMatchSuccessful,
          candidateCountAfterAlias,
          recommendedCount: recommended.length,
        });
      }
    }
  }

  // Spezialfall: Nur unbekannter Produktcode (alte Heuristik als Fallback)
  const onlyUnknownProductCode =
    Array.isArray(aiCoreTerms) &&
    Array.isArray(aiUnknownTerms) &&
    aiCoreTerms.length > 0 &&
    // alle echten inhaltlichen Begriffe sind unbekannt
    aiCoreTerms.every((t) => aiUnknownTerms.includes(t)) &&
    // mindestens ein Term sieht wie ein Code aus (z.B. ABC123)
    aiCoreTerms.some((t) => looksLikeProductCode(t));

  // AI-Trigger-Heuristik: Vereinfachte Logik
  // WICHTIG: Budget-Only-Queries dürfen NIE als unknown_product_code_only behandelt werden
  
  // Filtere triviale Wörter aus unknownTerms für AI-Trigger-Entscheidungen
  const filteredUnknownTerms = (aiUnknownTerms || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 1)
    .filter((t) => !UNKNOWN_AI_STOPWORDS_SET.has(t));
  
  const filteredUnknownCount = filteredUnknownTerms.length;

  // AI-Trigger initialisieren
  let aiTrigger: SellerBrainAiTrigger | undefined = undefined;

  // 1. Budget-Only-Queries: kein AI-Trigger
  if (isBudgetOnly) {
    console.log("[EFRO SB AI-Trigger] Skipped for budget-only query", {
      text: cleaned.substring(0, 100),
      finalCount,
      hasBudgetWord,
      isBudgetOnly,
      originalUnknownCount: aiUnknownTerms.length,
      filteredUnknownCount,
    });
    // KEIN AI-Trigger → aiTrigger bleibt undefined
  } else {
    // Restliche AI-Trigger-Entscheidungen kommen in diesen else-Block
    let needsAiHelp = false;
    let reason = "";

    // Hilfsflags für AI-Trigger (wiederverwenden, falls bereits berechnet)
    const hasRecommendations = finalCount > 0;
    const hasEffectiveCategory =
      !!effectiveCategorySlugForCodeDetect ||
      (matchedCategories && matchedCategories.length > 0) ||
      (categoryHintsInText && categoryHintsInText.length > 0);
    
    // a) Code-Only-Unknown-Fall (soll bleiben)
    // 1.3) AI-Trigger „unknown_product_code_only“ nur im echten Code-Only-Fall erlauben
    // WICHTIG: Wenn ein erfolgreicher AliasMatch vorhanden ist, darf unknown_product_code_only NICHT gesetzt werden
    if (
      unknownProductCodeOnly &&
      detectedCodeTerm &&
      !hasRecommendations &&       // also finalCount === 0
      !isBudgetOnly &&             // Budget-Only wird schon vorher geblockt
      !hasEffectiveCategory &&      // keine Kategorie im Spiel
      !aliasMatchSuccessful         // KEIN erfolgreicher AliasMatch vorhanden
    ) {
      needsAiHelp = true;
      reason = "unknown_product_code_only";
    } else if (
      onlyUnknownProductCode &&
      !hasRecommendations &&
      !hasBudgetWord &&
      !isBudgetOnly &&
      !hasEffectiveCategory &&
      !aliasMatchSuccessful         // KEIN erfolgreicher AliasMatch vorhanden
    ) {
      needsAiHelp = true;
      reason = "unknown_product_code_only";
    } else if (finalCount === 0) {
      needsAiHelp = true;
      reason = "no_results";
    } else if (filteredUnknownCount > 0 && finalCount > 0) {
      // b) Low-Confidence-Unknown-Terms-Fall: Nur wenn gefilterte Unknown-Terms vorhanden
      needsAiHelp = true;
      reason = "low_confidence_unknown_terms";
    } else if (filteredUnknownCount >= 3) {
      needsAiHelp = true;
      reason = "many_unknown_terms";
    }

    if (needsAiHelp) {
      aiTrigger = {
        needsAiHelp: true,
        reason,
        unknownTerms: reason === "unknown_product_code_only" ? [] : filteredUnknownTerms,
      };

      // Code-Term setzen, falls vorhanden
      if (unknownProductCodeOnly && detectedCodeTerm) {
        aiTrigger.codeTerm = detectedCodeTerm;
      } else if (onlyUnknownProductCode) {
        // Versuche Code-Term aus unknownTerms zu extrahieren
        const codeFromTerms = aiUnknownTerms.find((t) => looksLikeProductCode(t));
        if (codeFromTerms) {
          aiTrigger.codeTerm = codeFromTerms;
        }
      }
      
      console.log("[EFRO SB AI-Trigger] Set", {
        text: cleaned.substring(0, 100),
        reason,
        needsAiHelp,
        unknownProductCodeOnly,
        aliasMatchSuccessful,
        candidateCountAfterAlias,
        detectedCodeTerm,
        finalCount,
        note: aliasMatchSuccessful 
          ? "AliasMatch erfolgreich → unknown_product_code_only NICHT gesetzt"
          : "Kein AliasMatch → unknown_product_code_only kann gesetzt werden",
      });
    }
  }

  // Hilfsflags für AI-Trigger-Log (wiederverwenden, falls bereits berechnet)
  const hasRecommendationsForLog = recommended.length > 0;
  const hasEffectiveCategoryForLog =
    !!effectiveCategorySlugForCodeDetect ||
    (matchedCategories && matchedCategories.length > 0) ||
    (categoryHintsInText && categoryHintsInText.length > 0);

  console.log("[EFRO SB AI-Trigger]", {
    text: cleaned.substring(0, 100),
    finalCount: recommended.length,
    unknownCount: filteredUnknownCount,
    originalUnknownCount: aiUnknownTerms.length,
    needsAiHelp: aiTrigger?.needsAiHelp ?? false,
    reason: aiTrigger?.reason ?? "none",
    isBudgetOnly,
    hasBudgetWord,
    hasEffectiveCategory: hasEffectiveCategoryForLog,
    hasRecommendations: hasRecommendationsForLog,
    filteredUnknownTerms: filteredUnknownTerms.slice(0, 10), // Nur erste 10 für Übersicht
    unknownProductCodeOnly,
    codeTerm: aiTrigger?.codeTerm,
  });

  // Bestimme effectiveCategorySlug für nextContext
  // (muss aus filterProducts extrahiert werden, hier vereinfacht: aus recommended ableiten)
  let effectiveCategorySlug: string | null = null;
  if (recommended.length > 0 && recommended[0].category) {
    effectiveCategorySlug = normalize(recommended[0].category);
  } else if (context?.activeCategorySlug) {
    // Wenn keine Produkte gefunden, aber Kontext vorhanden, behalte Kontext
    // WICHTIG: Bei Budget-only-Queries mit Kontext soll der Kontext beibehalten werden
    effectiveCategorySlug = normalize(context.activeCategorySlug);
  }

  // WICHTIG: Bei Budget-only mit vorhandenem Kontext soll der Kontext beibehalten werden
  // auch wenn keine Produkte gefunden wurden oder recommended leer ist
  const isBudgetOnlyQuery = (() => {
    const { minPrice, maxPrice } = extractUserPriceRange(cleaned);
    const hasBudget = minPrice !== null || maxPrice !== null;
    if (!hasBudget) return false;
    const normalized = normalize(cleaned);
    // Importiert aus languageRules.de.ts
    const hasBudgetKeyword = BUDGET_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw));
    const parsed = parseQueryForAttributes(cleaned);
    // Importiert aus languageRules.de.ts
    const hasProductKeyword = PRODUCT_KEYWORDS_FOR_BUDGET_ONLY.some(kw => normalized.includes(kw));
    return hasBudgetKeyword && parsed.attributeTerms.length === 0 && !hasProductKeyword;
  })();

  if (isBudgetOnlyQuery && context?.activeCategorySlug && !effectiveCategorySlug) {
    // Budget-only mit Kontext: Kontext beibehalten
    effectiveCategorySlug = normalize(context.activeCategorySlug);
    console.log("[EFRO SB Context] Budget-only query, preserving context", {
      activeCategorySlug: effectiveCategorySlug,
      recommendedCount: recommended.length,
    });
  }

  const nextContext: SellerBrainContext | undefined = effectiveCategorySlug
    ? { activeCategorySlug: effectiveCategorySlug }
    : undefined;

  console.log("[EFRO SB Context] Outgoing nextContext", {
    activeCategorySlug: nextContext?.activeCategorySlug ?? null,
  });

  // Spezialfall: Bei unbekanntem Produktcode keine Produkte anzeigen
  // WICHTIG: Nur wenn es KEINE Budget-Only-Query ist UND KEIN erfolgreicher AliasMatch vorhanden ist
  if (
    aiTrigger?.reason === "unknown_product_code_only" && 
    !hasBudgetWord && 
    !isBudgetOnly &&
    !aliasMatchSuccessful
  ) {
    recommended = [];
    console.log("[EFRO SB] Produkte verworfen (unknown_product_code_only, kein AliasMatch)", {
      text: cleaned.substring(0, 100),
      reason: aiTrigger.reason,
      aliasMatchSuccessful,
      candidateCountAfterAlias,
    });
  } else if (aiTrigger?.reason === "unknown_product_code_only" && aliasMatchSuccessful) {
    console.log("[EFRO SB] Produkte NICHT verworfen (unknown_product_code_only, aber AliasMatch erfolgreich)", {
      text: cleaned.substring(0, 100),
      reason: aiTrigger.reason,
      aliasMatchSuccessful,
      candidateCountAfterAlias,
      recommendedCount: recommended.length,
    });
  }

  // Reply-Text mit AI-Klärung neu generieren, falls aiTrigger vorhanden
  let finalReplyText = replyText;
  if (aiTrigger?.needsAiHelp) {
    finalReplyText = buildReplyText(cleaned, nextIntent, recommended, aiTrigger);
  }

  // Defensive Guard: Stelle sicher, dass replyText niemals leer oder undefined ist
  if (!finalReplyText || typeof finalReplyText !== "string" || finalReplyText.trim().length === 0) {
    console.warn("[EFRO SB] Empty replyText detected, using fallback", {
      userText: cleaned.substring(0, 100),
      originalReplyText: finalReplyText,
      recommendedCount: recommended.length,
    });
    finalReplyText =
      "Ich habe deine Anfrage erhalten. Bitte beschreibe dein Anliegen etwas genauer, dann kann ich dir besser helfen.";
  }

  console.log("[EFRO SB RETURN]", {
    text: cleaned,
    intent: nextIntent,
    finalCount: recommended.length,
    replyText: finalReplyText,
    replyTextLength: finalReplyText.length,
    aiTrigger,
    nextContext,
  });

  return {
    intent: nextIntent,
    recommended: recommended || [],
    replyText: finalReplyText,
    nextContext,
    aiTrigger,
  };
}

// ------------------------------------------------------
// Spezialisierte Logik für Schimmel-Anfragen
// ------------------------------------------------------

function isMoldQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  // Typische deutsche Formulierungen für Schimmel
  // Importiert aus languageRules.de.ts
  return MOLD_KEYWORDS.some((kw) => t.includes(kw));
}

function isMoldProduct(product: EfroProduct): boolean {
  const parts: string[] = [];

  if (product.title) parts.push(String(product.title));
  if (product.description) parts.push(String(product.description));
  if (product.category) parts.push(String(product.category));

  const rawTags = (product as any).tags;
  if (Array.isArray(rawTags)) {
    parts.push(rawTags.map((t) => String(t)).join(" "));
  } else if (typeof rawTags === "string") {
    parts.push(rawTags);
  }

  const full = parts.join(" ").toLowerCase();

  // Importiert aus languageRules.de.ts
  return MOLD_KEYWORDS.some((kw) => full.includes(kw));
}

