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
import {
  normalizeText,
  normalize,
  getDescriptionSnippet,
  extractStepsFromDescription,
} from "@/lib/sales/modules/utils";


import {
  extractNumbersForBudget,
  extractUserPriceRange,
  UserPriceRange,
  analyzeBudget,
} from "./budget";







import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import { detectIntentFromText, detectMostExpensiveRequest } from "./intent";
// Import der generierten Hints aus JSON
// Hinweis: TypeScript erwartet hier einen Typ-Assertion, da JSON-Imports als any kommen
import generatedProductHintsJson from "./generatedProductHints.json";
// Import für SellerBrain v2 (Repository & Cache)
import {
  getEfroShopByDomain,
  getEfroDemoShop,
  getProductsForShop,
  getCachedResponse,
  upsertCachedResponse,
  type EfroCachedResponse,
} from "../efro/efroSupabaseRepository";
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
  getDynamicSynonyms,
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
  WAX_HAIR_KEYWORDS,
  WAX_SNOWBOARD_KEYWORDS,
} from "./languageRules.de";
import type { LanguageRule } from "./types";
import { resolveTermWithLanguageRules } from "./resolveLanguageRule";

import { isPerfumeProduct, isMoldProduct } from "./categories";

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
  reason?: string;
  /** Begriffe, die bisher nicht gut aufgelöst wurden */
  unknownTerms?: string[];
  /** Erkannter Produktcode wie "ABC123" */
  codeTerm?: string;
  /** Unbekannte Produktcodes (z. B. ["XY-9000"]) */
  unknownProductCodes?: string[];
  /** Original-Query für AI (z. B. für Erklärungen) */
  queryForAi?: string;
  /** Kontext für AI (z. B. matchedProducts für Erklärungen) */
  context?: {
    matchedProducts?: Array<{ id: string; title: string; category?: string }>;
    /** EFRO WAX-Fix: Produktbeschreibung für AI-Zusammenfassung */
    productDescription?: string;
  };
  /** EFRO Fressnapf-Fix: Strukturierte Anfragen für unbekannte Begriffe */
  termExplainRequests?: Array<{
    term: string;
    purpose: "category_guess" | "semantic_help";
  }>;
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
  /** EFRO Budget-Fix 2025-11-30: Flag, wenn keine Produkte im gewünschten Preisbereich gefunden wurden */
  priceRangeNoMatch?: boolean;
  /** EFRO Budget-Fix 2025-11-30: Preisbereich-Informationen für ehrliche Kommunikation */
  priceRangeInfo?: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  };
  /** EFRO Budget-Fix 2025-11-30: Fehlende Kategorie-Hinweis (z. B. "Bindungen" nicht im Katalog) */
  missingCategoryHint?: string;
  /** EFRO Explanation-Mode: true, wenn der User eine Erklärung anfordert */
  explanationMode?: boolean;
  /** EFRO WAX-Fix: Debug-Flags für fehlende Beschreibungen etc. */
  debugFlags?: {
    missingDescription?: boolean;
  };
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
/**
 * EFRO Explanation-Mode-Erkennung verbessert
 * Erkennt Fragen wie "Wie benutze ich...?", "Erklär mir...", "Wie funktioniert...?"
 * EFRO S18/S19 Fix: Robuste Erkennung für "Wie wende ich...", "Wie genau funktioniert..."
 */
function detectExplanationMode(text: string): ExplanationMode | null {
  const t = normalize(text || "");
  if (!t) return null;

  // EFRO S18/S19 Fix: Robuste Pattern-Erkennung für Usage-Mode
  const normalized = text.toLowerCase();
  
  const usagePatterns: RegExp[] = [
    /wie\s+wende\s+ich\b/i,
    /\banwendung\b/i,
    /\banwenden\b/i,
    /wie\s+genau\s+funktioniert\b/i,
    /wie\s+funktioniert\b/i,
    /funktioniert\s+dies(es|er|e)?\s+\w*\b/i,
    /erkl(ä|a)r(e|st|en)?\s+(mir\s+)?(bitte\s+)?(mal\s+)?(genau\s+)?wie\b/i,
    /wie\s+benutze\s+ich\b/i,
    /wie\s+verwende\s+ich\b/i,
    /wie\s+nutze\s+ich\b/i,
  ];

  const hasUsagePattern = usagePatterns.some((re) => re.test(normalized));

  // Erweiterte Erkennung für Erklärungsanfragen
  if (
    t.includes("erklär") ||
    t.includes("erklaer") ||
    t.includes("erkläre") ||
    t.includes("erklaere") ||
    t.includes("wie benutze ich") ||
    t.includes("wie verwende ich") ||
    t.includes("wie funktioniert") ||
    t.startsWith("was ist ") ||
    t.startsWith("was sind ") ||
    hasUsagePattern
  ) {
    // Zutaten / Inhaltsstoffe
    if (EXPLANATION_MODE_KEYWORDS.ingredients.some((w) => t.includes(w))) {
    return "ingredients";
  }

  // Anwendung / benutzen
    if (EXPLANATION_MODE_KEYWORDS.usage.some((w) => t.includes(w)) || hasUsagePattern) {
    return "usage";
  }

  // Waschen / Pflege
    if (EXPLANATION_MODE_KEYWORDS.washing.some((w) => t.includes(w))) {
    return "washing";
  }

    // Fallback: generische Erklärung
    return "usage";
  }

  // Bestehende Logik beibehalten
  if (EXPLANATION_MODE_KEYWORDS.ingredients.some((w) => t.includes(w))) {
    return "ingredients";
  }

  if (EXPLANATION_MODE_KEYWORDS.usage.some((w) => t.includes(w)) || hasUsagePattern) {
    return "usage";
  }

  if (EXPLANATION_MODE_KEYWORDS.washing.some((w) => t.includes(w))) {
    return "washing";
  }

  return null;
}

/**
 * EFRO WAX-Fix: Extrahiert Schritte aus einer Produktbeschreibung
 * Erkennt strukturierte Anleitungen (z. B. "Belag reinigen:", "Wachs auftragen:", etc.)
 */



/**
 * EFRO S18/S19 Fix: Patch für ProductRelated bei Wax-Erklärungen
 */
function patchProductRelatedForWax(
  result: { isProductRelated: boolean; reason: string },
  normalizedText: string,
  explanationMode: ExplanationMode | null
) {
  if (!result.isProductRelated && explanationMode && /\b(wax|wachs)\b/i.test(normalizedText)) {
    result.isProductRelated = true;
    result.reason = "coreProductKeyword_wax";
  }
}

/**
 * EFRO S18/S19 Fix: Handle Wax-Erklärungen mit AI-Trigger
 */
function handleWaxExplanation(
  text: string,
  products: EfroProduct[],
  explanationMode: ExplanationMode | null,
  previousCount: number
): {
  explanationMode: ExplanationMode | null;
  previousCount: number;
  usedCount: number;
  maxRecommendations: number;
  hasCategoryFromQuery: boolean;
  waxProductsFound: boolean;
  hasUsableDescription: boolean;
  descriptionLength: number;
  stepsExtracted: number;
  aiTrigger?: SellerBrainAiTrigger;
} {
  const normalized = text.toLowerCase();
  const mentionsWax = /\b(wax|wachs)\b/.test(normalized);

  // Wenn keine Erklärfrage oder kein Wax erwähnt wird, nichts Besonderes tun
  if (!explanationMode || !mentionsWax) {
    return {
      explanationMode,
      previousCount,
      usedCount: 0,
      maxRecommendations: 2,
      hasCategoryFromQuery: false,
      waxProductsFound: false,
      hasUsableDescription: false,
      descriptionLength: 0,
      stepsExtracted: 0,
    };
  }

  // Wax-Produkte im Katalog finden
  const waxProducts = products.filter((p) => {
    const title = (p.title ?? "").toLowerCase();
    const tagsText = Array.isArray(p.tags) ? p.tags.join(" ").toLowerCase() : "";
    const category = (p.category ?? "").toLowerCase();
    return (
      title.includes("wax") ||
      title.includes("wachs") ||
      tagsText.includes("wax") ||
      tagsText.includes("wachs") ||
      category.includes("wax") ||
      category.includes("wachs")
    );
  });

  const waxProductsFound = waxProducts.length > 0;
  const maxRecommendations = 2;

  let hasUsableDescription = false;
  let descriptionLength = 0;
  let stepsExtracted = 0;
  let bestDescription = "";

  // Längste, nicht-leere Beschreibung suchen (z. B. "Selling Plans Ski Wax")
  for (const p of waxProducts) {
    const desc = (p.description ?? "").trim();
    if (!desc) continue;
    const len = desc.length;
    if (len > descriptionLength) {
      descriptionLength = len;
      bestDescription = desc;
    }
  }

  if (descriptionLength >= 80) {
    hasUsableDescription = true;
    const rawLines = bestDescription
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    stepsExtracted = rawLines.length;
  }

  console.log("[EFRO Explanation Wax] Wax-Produkte gefunden (keine Kategorie erkannt)", {
    text,
    waxProductsCount: waxProducts.length,
    sampleTitles: waxProducts.slice(0, 3).map((p) => p.title),
  });

  const result = {
    explanationMode: "usage" as const,
    previousCount,
    usedCount: 0,
    maxRecommendations,
    hasCategoryFromQuery: false,
    waxProductsFound,
    hasUsableDescription,
    descriptionLength,
    stepsExtracted,
  };

  console.log("[EFRO SellerBrain] Explanation mode – Direkt aus Beschreibung", {
    text,
    ...result,
  });

  // EFRO Fix: KEIN AI-Trigger mehr für Erklärungen mit/ohne Beschreibung
  // Die Antwort wird direkt aus der Beschreibung generiert (wenn vorhanden)
  // oder ehrlich kommuniziert, dass keine Beschreibung vorhanden ist (ohne AI)
  // AI wird nur für unbekannte Begriffe (z. B. "Fressnapf") genutzt
  const aiTrigger: SellerBrainAiTrigger | undefined = undefined;

  return {
    ...result,
  };
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

    // EFRO Fix 2025-12-05: Budget-/Preis-Sätze auch ohne explizites Budgetwort
    // als produktbezogen werten, sobald eine konkrete Euro-Angabe vorhanden ist
    // (z. B. "Ich habe nur 20 Euro.", "Ich möchte über 100 Euro ausgeben.").
    if (hasEuroNumber) {
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

/**
 * Erkennt, ob der User explizit nach dem teuersten Produkt fragt
 */

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
/**
 * EFRO Budget-Parser: Extrahiert Zahlen für Budget, ignoriert Zahlen in Produktcodes
 * 
 * Unterscheidet zwischen "reinen Zahlen" (z. B. "50") und Zahlen in alphanumerischen Tokens (z. B. "XY-9000").
 * Bei "Zeig mir Produkte für XY-9000 unter 50 Euro" wird nur 50 als Budget interpretiert, nicht 9000.
 */



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

    // NEU: Napf/Futternapf als eigene Familie "bowl"
    // WICHTIG: "fressnapf" wurde entfernt - soll dynamisch über AI gelernt werden
    if (/napf|futternapf/.test(normalized)) {
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
  const debugFlags: string[] = [];

// Alias: in dieser Funktion ist "cleaned" einfach der Text aus runSellerBrain
  const cleaned = text;

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
      hasPriceInfo: userMinPriceForLog !== undefined || userMaxPriceForLog !== undefined,
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

  const budgetAnalysis = analyzeBudget(text);
  let userMinPrice = budgetAnalysis.userMinPrice;
  let userMaxPrice = budgetAnalysis.userMaxPrice;

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
    // EFRO Fix: Kategorie-Erkennung mit Wortgrenzen (verhindert "modern" -> "mode")
    allCategories.forEach((cat) => {
      if (cat) {
        // Verwende Wortgrenzen (\b) für exakte Matches, verhindert Substring-Matches
        const catRegex = new RegExp(`\\b${cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (catRegex.test(t)) {
          matchedCategories.push(cat);
          categoryHintsInText.push(cat);
        }
      }
    });
  }

  // Wort-Classification: Kategorien aus languageRules.de erkennen (additiv)
  // EFRO Fix: collectMatches verwendet bereits Wortgrenzen, aber wir filtern "modern" explizit heraus
  const fullTextLowerForCategory = t.toLowerCase();
  const categoryHintsFromRules = collectMatches(fullTextLowerForCategory, CATEGORY_KEYWORDS);
  
    // EFRO Fix: Negativliste für Wörter, die NICHT als "mode" erkannt werden sollen
  const modeNegativeWords = ["modern", "moderne", "moderner", "modernes", "modernen", "modell", "modem"];

  const filteredHints = categoryHintsFromRules.filter((hint) => {
    const normalizedHint = normalize(hint);

    if (normalizedHint === "mode") {
      // Prüfe, ob "modern" oder ähnliche Wörter im Text vorkommen
      const hasNegativeWord = modeNegativeWords.some((negWord) =>
        new RegExp(`\\b${negWord}\\b`, "i").test(fullTextLowerForCategory)
      );

      if (hasNegativeWord) {
        console.log("[EFRO SB Category] Ignored 'mode' match (negative word detected)", {
          hint,
          negativeWords: modeNegativeWords.filter((negWord) =>
            new RegExp(`\\b${negWord}\\b`, "i").test(fullTextLowerForCategory)
          ),
        });
        return false;
      }
    }

    return true;
  });

  // EFRO Haustier-Fix:
  // Mappe "tierbedarf" (aus languageRules) auf die echte Katalog-Kategorie "haustier", falls vorhanden.
  // Hintergrund: Szenario I4 ("Premium-Produkte für Haustiere") erkennt zwar "tierbedarf",
  // aber im Katalog heißt die Kategorie "haustier".
  const hasHaustierCategory = allCategories.some(
    (cat) => normalize(cat) === "haustier"
  );
  const hasTierbedarfHint = filteredHints.some(
    (hint) => normalize(hint) === "tierbedarf"
  );

  if (hasHaustierCategory && hasTierbedarfHint) {
    const haustierCategory = allCategories.find(
      (cat) => normalize(cat) === "haustier"
    );
    if (
      haustierCategory &&
      !matchedCategories.some(
        (cat) => normalize(cat) === normalize(haustierCategory)
      )
    ) {
      matchedCategories.push(haustierCategory);
      categoryHintsInText.push(haustierCategory);
      // Wichtig: missingCategoryHint in diesem Fall nicht setzen
    }
  }

  
  // categoryHints additiv zu matchedCategories hinzufügen (nur wenn noch nicht vorhanden)
  for (const hint of filteredHints) {
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
  } else if (filteredHints.length > 0) {
    // Fallback: Wenn categoryHints vorhanden sind, aber keine matchedCategories, versuche die erste categoryHint zu nutzen
    const firstHint = filteredHints[0];
    const normalizedHint = normalize(firstHint);
    const matchingCategory = allCategories.find((cat) => normalize(cat) === normalizedHint);
    if (matchingCategory) {
      effectiveCategorySlug = normalize(matchingCategory);
    }
  }

  // EFRO Budget-Fix 2025-11-30: Prüfe, ob eine Kategorie-Hint erkannt wurde, aber nicht im Katalog existiert
  // (z. B. "Bindungen" erkannt, aber keine Bindungen im Katalog)
  let missingCategoryHint: string | undefined = undefined;
  if (filteredHints.length > 0 && matchedCategories.length === 0 && effectiveCategorySlug === null) {
    // Eine Kategorie wurde im Text erkannt (z. B. "Bindungen"), aber nicht im Katalog gefunden
    const firstHint = filteredHints[0];
    const normalizedHint = normalize(firstHint);
    const existsInCatalog = allCategories.some((cat) => normalize(cat) === normalizedHint);
    if (!existsInCatalog) {
      missingCategoryHint = firstHint;
      console.log("[EFRO SB Category] Missing category hint detected", {
        text: text.substring(0, 80),
        missingCategoryHint,
        note: "Kategorie im Text erkannt, aber nicht im Katalog vorhanden",
      });
    }
  }

  // EFRO Fix: Bestimme triggerWord für Log
  let triggerWord: string | null = null;
  if (matchedCategories.length > 0) {
    // Finde das Wort, das die Kategorie ausgelöst hat
    const matchedCat = matchedCategories[0];
    const normalizedMatchedCat = normalize(matchedCat);
    
    // Prüfe, ob es aus categoryHintsInText kommt
    if (categoryHintsInText.includes(matchedCat)) {
      triggerWord = matchedCat;
    } else {
      // Prüfe, ob es aus filteredHints kommt
      const hintMatch = filteredHints.find((h) => normalize(h) === normalizedMatchedCat);
      if (hintMatch) {
        triggerWord = hintMatch;
      }
    }
  }


  // EFRO Category Override für spezifische Produktwörter (Wasserkocher, Smartphone, Jeans/Mode)
  const textLowerForOverrides = text.toLowerCase();

  // Wasserkocher → Haushalt
  if (/\b(wasserkocher|electric kettle|kettle)\b/.test(textLowerForOverrides)) {
    const hasHaushaltCategory = allCategories.some(
      (cat) => normalize(cat) === "haushalt"
    );
    if (hasHaushaltCategory) {
      effectiveCategorySlug = "haushalt";
    }
  }
  // Smartphone/Handy → Elektronik
  else if (/\b(smartphone|handy|phone)\b/.test(textLowerForOverrides)) {
    const hasElektronikCategory = allCategories.some(
      (cat) => normalize(cat) === "elektronik"
    );
    if (hasElektronikCategory) {
      effectiveCategorySlug = "elektronik";
    }
  }
  // Jeans/Hose/T-Shirt/Kleidung → Mode
  else if (/\b(jeans|hose|t[- ]?shirt|kleidung)\b/.test(textLowerForOverrides)) {
    const hasModeCategory = allCategories.some(
      (cat) => normalize(cat) === "mode"
    );
    if (hasModeCategory) {
      effectiveCategorySlug = "mode";
    }
  }




  console.log("[EFRO SB Category] Effective category", {
    fromText: matchedCategories.length > 0 ? matchedCategories[0] : null,
    fromContext: contextCategory ?? null,
    effective: effectiveCategorySlug,
    missingCategoryHint: missingCategoryHint ?? null,
    triggerWord: triggerWord ?? null,
  });

  // Filtere nach effectiveCategorySlug (entweder aus Text oder aus Kontext)
  // 🔧 EFRO Category Filter Fix:
  // - Nur dann hart nach Kategorie filtern, wenn es mindestens ein Produkt
  //   mit diesem Category-Slug gibt.
  // - Wenn kein Produkt diese Kategorie hat, Kandidaten NICHT auf 0 schießen,
  //   sondern missingCategoryHint setzen und einen Debug-Hinweis schreiben.
  if (effectiveCategorySlug) {
    const beforeCategoryFilterCount = candidates.length;

    const filteredByCategory = candidates.filter(
      (p) => normalize(p.category || "") === effectiveCategorySlug
    );

    if (filteredByCategory.length > 0) {
      // Es gibt wirklich Produkte mit dieser Kategorie → normal filtern.
      candidates = filteredByCategory;
    } else {
      // Kein Produkt mit diesem Slug → nicht alles wegfiltern.
      // Stattdessen nur Hinweis setzen.
      if (beforeCategoryFilterCount > 0) {
        debugFlags.push(
          `category_no_match_for_slug:${effectiveCategorySlug}`
        );
      }
      if (!missingCategoryHint) {
        missingCategoryHint = effectiveCategorySlug;
      }
      // candidates bleibt unverändert.
    }
    
    // TODO Vorschlag: Bei Budget-only Anfragen (ohne Produktkategorie) könnte man
    // den Kategorie-Filter optional machen, damit nicht alle Produkte wegfallen.
    // Aktuell: Kategorie-Filter ist hart, was bei "zeig mir Parfüm" korrekt ist,
    // aber bei "50 Euro Budget" ohne Kategorie könnte es zu streng sein.
    
    console.log("[EFRO SB] AFTER CATEGORY FILTER", {
      text: text.substring(0, 80),
      matchedCategories,
      effectiveCategorySlug,
      beforeCount: beforeCategoryFilterCount,
      afterCount: candidates.length,
      isBudgetOnly: (userMinPrice !== null || userMaxPrice !== null) && matchedCategories.length === 0,
    });
  } else {
    // EFRO Fallback-Suche: Wenn keine Kategorie erkannt wurde, suche direkt in Titel/Beschreibung/Tags
    const hasCategoryFromQuery = !!effectiveCategorySlug;
    
    if (!hasCategoryFromQuery) {
      // Fallback: Suche direkt in Produkten nach Query-Begriffen
      const normalizedText = normalize(text);
      const tokens = normalizedText.split(/\s+/).filter((w) => w.length >= 3);
      
      // EFRO WAX-Disambiguierung: Unterscheide zwischen Haarwachs und Snowboard-Wachs
      const hasWaxKeyword = normalizedText.includes("wax") || normalizedText.includes("wachs");
      const hasHairKeywords = WAX_HAIR_KEYWORDS.some((kw) => normalizedText.includes(kw));
      const hasSnowboardKeywords = WAX_SNOWBOARD_KEYWORDS.some((kw) => normalizedText.includes(kw));
      
      // Prüfe auf explizite Negationen
      const hasHairNegation = /nicht.*haar|kein.*haar|nicht.*frisur|kein.*frisur/i.test(text);
      const hasSnowboardNegation = /nicht.*snowboard|kein.*snowboard|nicht.*ski|kein.*ski|nicht.*board|kein.*board/i.test(text);
      
      // Intent bestimmen
      let waxIntent: "hair" | "snowboard" | "unknown" = "unknown";
      if (hasHairNegation && hasSnowboardKeywords) {
        waxIntent = "snowboard";
      } else if (hasSnowboardNegation && hasHairKeywords) {
        waxIntent = "hair";
      } else if (hasSnowboardKeywords) {
        waxIntent = "snowboard";
      } else if (hasHairKeywords) {
        waxIntent = "hair";
      }
      
      const fallbackMatches = candidates.filter((p) => {
        const haystack = (
          (p.title ?? "") +
          " " +
          (p.description ?? "") +
          " " +
          (p.category ?? "") +
          " " +
          (Array.isArray(p.tags) ? p.tags.join(" ") : "")
        ).toLowerCase();
        
        // EFRO WAX-Disambiguierung: Wenn "wax"/"wachs" im Query ist, prüfe Intent
        if (hasWaxKeyword) {
          const hasWaxInTitle = (p.title ?? "").toLowerCase().includes("wax") || 
                                (p.title ?? "").toLowerCase().includes("wachs");
          const hasWaxInTags = Array.isArray(p.tags) && p.tags.some((tag: string) => 
            tag.toLowerCase().includes("wax") || tag.toLowerCase().includes("wachs")
          );
          
          if (hasWaxInTitle || hasWaxInTags) {
            // Prüfe, ob Produkt zu Intent passt
            const isSnowboardWax = haystack.includes("snowboard") || 
                                   haystack.includes("ski") || 
                                   haystack.includes("belag") ||
                                   (Array.isArray(p.tags) && p.tags.some((tag: string) => 
                                     ["sport", "winter", "accessory", "accessories"].includes(tag.toLowerCase())
                                   ));
            const isHairWax = haystack.includes("hair") || 
                             haystack.includes("haar") || 
                             haystack.includes("styling") ||
                             haystack.includes("frisur");
            
            // Intent-basierte Filterung
            if (waxIntent === "snowboard" && !isSnowboardWax) {
              return false; // Haarwachs bei Snowboard-Intent ausschließen
            }
            if (waxIntent === "hair" && !isHairWax) {
              return false; // Snowboard-Wachs bei Hair-Intent ausschließen
            }
            
            return true; // Wax-Produkt gefunden, auch ohne Kategorie
          }
        }
        
        // Simple ANY-match: mindestens ein Token muss vorkommen
        return tokens.some((t) => haystack.includes(t));
      });
      
      console.log("[EFRO WAX Disambiguierung]", {
        text: text.substring(0, 80),
        hasWaxKeyword,
        hasHairKeywords,
        hasSnowboardKeywords,
        hasHairNegation,
        hasSnowboardNegation,
        waxIntent,
        fallbackMatchesCount: fallbackMatches.length,
      });
      
      if (fallbackMatches.length > 0) {
        candidates = fallbackMatches;
        console.log("[EFRO SB Fallback] Keine Kategorie erkannt, Fallback-Suche in Titel/Beschreibung/Tags", {
          text: text.substring(0, 80),
          tokens: tokens.slice(0, 5),
          fallbackMatchesCount: fallbackMatches.length,
          sampleTitles: fallbackMatches.slice(0, 3).map((p) => p.title),
          hasWaxKeyword,
          waxProductsFound: hasWaxKeyword ? fallbackMatches.filter((p) => 
            (p.title ?? "").toLowerCase().includes("wax") || 
            (p.title ?? "").toLowerCase().includes("wachs")
          ).length : 0,
        });
      }
    }
    
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
  
  // EFRO: Integriere dynamische Synonyme in die Kategorie-Erkennung
  const dynEntries = getDynamicSynonyms();
  const dynamicCategoryHints: string[] = [];
  const tokens = fullTextLower.split(/\s+/).filter((w) => w.length >= 3);
  
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const dyn = dynEntries.find((e) => lower.includes(e.term) || e.term.includes(lower));
    if (dyn?.canonicalCategory) {
      dynamicCategoryHints.push(dyn.canonicalCategory);
      console.log("[EFRO DynamicSynonym] Kategorie aus dynamischem Synonym erkannt", {
        term: dyn.term,
        canonicalCategory: dyn.canonicalCategory,
        token,
      });
    }
  }
  
  const categoryHints = collectMatches(fullTextLower, CATEGORY_KEYWORDS);
  // Ergänze dynamische Kategorie-Hints
  if (dynamicCategoryHints.length > 0) {
    categoryHints.push(...dynamicCategoryHints);
  }
  
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
  // in bekannte Keywords aufgelöst werden
  // EFRO Fressnapf-Fix: "fressnapf" soll NICHT als Alias verwendet werden, sondern als unbekannte Marke behandelt werden
  // Erstelle eine gefilterte AliasMap ohne "fressnapf"
  const filteredAliasMap: AliasMap = {};
  for (const [key, values] of Object.entries(aliasMap)) {
    const normalizedKey = normalizeAliasKey(key);
    // Ignoriere "fressnapf" in der AliasMap
    if (normalizedKey !== "fressnapf") {
      filteredAliasMap[key] = values;
    }
  }
  
  const aliasResult = resolveUnknownTerms(text, catalogKeywords, filteredAliasMap);

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

  const hasBudget = userMinPrice !== undefined || userMaxPrice !== undefined;

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

      // EFRO: Erweitere Core-Match um LanguageRule-Keywords
      // Prüfe, ob einer der coreTerms eine LanguageRule hat (dynamisch gelernt)
      const languageRuleKeywords: string[] = [];
      for (const coreTerm of coreTerms) {
        const dynEntries = getDynamicSynonyms();
        const dyn = dynEntries.find((e) => 
          e.term.toLowerCase() === coreTerm.toLowerCase() ||
          coreTerm.toLowerCase().includes(e.term.toLowerCase())
        );
        if (dyn) {
          // Füge canonical und keywords zur Suche hinzu
          if (dyn.canonical) {
            languageRuleKeywords.push(dyn.canonical);
          }
          if (dyn.keywords?.length) {
            languageRuleKeywords.push(...dyn.keywords);
          }
          if (dyn.extraKeywords?.length) {
            languageRuleKeywords.push(...dyn.extraKeywords);
          }
        }
      }
      
      // Core-Match: Mindestens 1 coreTerm, expandedWord oder LanguageRule-Keyword muss vorkommen
      const hasCoreMatch =
        (coreTerms.length === 0 && expandedWords.length === 0 && languageRuleKeywords.length === 0) ||
        coreTerms.some((term) => searchText.includes(term)) ||
        expandedWords.some((word) => searchText.includes(word)) ||
        languageRuleKeywords.some((keyword) => searchText.includes(keyword.toLowerCase()));

      if (!hasCoreMatch && (coreTerms.length > 0 || expandedWords.length > 0 || languageRuleKeywords.length > 0)) {
        return { product: p, score: 0, attributeScore: 0 };
      }

      // Keyword-Score mit erweiterten Wörtern (inkl. aufgebrochene Komposita)
      // EFRO: Erweitere expandedWords um LanguageRule-Keywords für besseres Matching
      const expandedWordsWithLanguageRules = [
        ...expandedWords,
        ...languageRuleKeywords.map((kw) => kw.toLowerCase()),
      ];
      const keywordScore = scoreProductForWords(p, expandedWordsWithLanguageRules);

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

      // EFRO: Bonus für LanguageRule-CategoryHints-Matching
      let languageRuleBonus = 0;
      if (languageRuleKeywords.length > 0) {
        const dynEntries = getDynamicSynonyms();
        for (const coreTerm of coreTerms) {
          const dyn = dynEntries.find((e) => 
            e.term.toLowerCase() === coreTerm.toLowerCase() ||
            coreTerm.toLowerCase().includes(e.term.toLowerCase())
          );
          if (dyn?.categoryHints?.length) {
            // Prüfe, ob Produkt-Kategorie oder Tags zu categoryHints passen
            const productCategory = normalize(p.category || "");
            const productTags = Array.isArray((p as any).tags) 
              ? (p as any).tags.map((t: string) => normalize(t))
              : [];
            
            const matchesCategoryHint = dyn.categoryHints.some((hint) => {
              const normalizedHint = normalize(hint);
              return productCategory.includes(normalizedHint) ||
                     productTags.some((tag: string) => tag.includes(normalizedHint));
            });
            
            if (matchesCategoryHint) {
              languageRuleBonus += 2; // Bonus für Kategorie-Match
            }
          }
        }
      }
      
      // Gesamt-Score: Keywords + Text-Attribute + strukturierte Attribute + LanguageRule-Bonus
      let totalScore =
        keywordScore + attributeScore * 2 + structuredAttributeScore * 3 + languageRuleBonus;

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

                // EFRO Perfume-Fix:
        // 1) Erst die "echten" Parfüm-Produkte über isPerfumeProduct()
        // 2) Fallback: Produkte aus Haushalt/Werkzeug, die klar nach Duft/Parfüm klingen
        const perfumeCandidates = perfumeSource.filter((p) => {
          // A) Original-Logik: echte Parfüm-Produkte aus categories.ts
          if (isPerfumeProduct(p)) {
            return true;
          }

          // B) Fallback: Produkte mit "Duft/Parfüm" im Titel/Beschreibung,
          // auch wenn Kategorie im Katalog z.B. "haushalt" oder "werkzeug" heißt
          const category = normalize(p.category || "");
          const title = normalize(p.title || "");
          const desc = normalize(p.description || "");

          const looksLikePerfumeText =
            title.includes("parfum") ||
            title.includes("parfüm") ||
            title.includes("duft") ||
            desc.includes("parfum") ||
            desc.includes("parfüm") ||
            desc.includes("duft");

          const isHouseholdOrTools =
            category === "haushalt" || category === "werkzeug";

          if (isHouseholdOrTools && looksLikePerfumeText) {
            return true;
          }

          return false;
        });


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
   * Filtert auf oberstes Preissegment (Top-25%, 75-Perzentil) mit sicherem Fallback
   * → Premium-Anfragen sollen niemals mit 0 Produkten enden.
   */
  if (
    currentIntent === "premium" &&
    userMinPrice === null &&
    userMaxPrice === null &&
    !wantsMostExpensive
  ) {
    // Preise aus aktuellen Kandidaten sammeln
    const priceValues = candidates
      .map((c) => c.price ?? 0)
      .filter((p) => typeof p === "number" && p > 0)
      .sort((a, b) => a - b); // aufsteigend

    if (priceValues.length === 0) {
      console.log("[EFRO PREMIUM_HIGH_END_FILTER]", {
        text,
        skipped: true,
        reason: "no valid prices found",
      });
    } else {
      // 75-Perzentil: Top-25 % der teuersten Produkte
      const idx = Math.floor(priceValues.length * 0.75);
      const threshold = priceValues[Math.min(idx, priceValues.length - 1)];

      const beforeCount = candidates.length;
      const originalCandidates = [...candidates];

      // High-End-Produkte im aktuellen Kandidaten-Set
      candidates = candidates.filter((c) => {
        const price = c.price ?? 0;
        return price >= threshold;
      });

      // Fallback: Wenn alles rausgefiltert wird → nimm einfach die 3 teuersten
      if (candidates.length === 0 && originalCandidates.length > 0) {
        const sortedByPriceDesc = [...originalCandidates]
          .filter((c) => (c.price ?? 0) > 0)
          .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

        candidates = sortedByPriceDesc.slice(
          0,
          Math.min(3, sortedByPriceDesc.length)
        );
      }

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
   *
   * Interpretiert die vom Budget-Parser erkannte userMinPrice/userMaxPrice-Spanne
   * und passt sie anhand der Sprache an:
   *   - "über 500 Euro"  → minPrice = 500, maxPrice = null
   *   - "unter 300 Euro" → minPrice = null, maxPrice = 300
   *   - "bis 100 Euro"   → minPrice = null, maxPrice = 100
   */
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // Rohwerte aus dem Parser
  let rawMin: number | null = userMinPrice ?? null;
  let rawMax: number | null = userMaxPrice ?? null;

  // Sprachbasierte Korrektur für "über / unter / bis / maximal"
  const loweredForBudget = text.toLowerCase();

  // ⚠️ Kein Regex mit Wortgrenzen mehr – wir arbeiten mit einfachen includes,
  // damit auch kaputte Markups wie "%]%ber 800" erkannt werden.
  const hasOverToken =
    loweredForBudget.includes("über") ||
    loweredForBudget.includes("ueber") ||
    loweredForBudget.includes("uber") ||
    loweredForBudget.includes(" mindest") ||
    loweredForBudget.includes("minimum") ||
    loweredForBudget.includes("mehr als") ||
    loweredForBudget.includes("groesser als") ||
    loweredForBudget.includes("größer als") ||
    loweredForBudget.includes(" ab ") ||
    loweredForBudget.includes(" ber ");

  const hasUnderToken =
    loweredForBudget.includes("unter") ||
    loweredForBudget.includes(" bis ") ||
    loweredForBudget.includes("höchstens") ||
    loweredForBudget.includes("hochstens") ||
    loweredForBudget.includes("hoechstens") ||
    loweredForBudget.includes(" maximal") ||
    loweredForBudget.includes(" max ") ||
    loweredForBudget.includes("weniger als") ||
    loweredForBudget.includes("nicht mehr als");

  if (rawMin !== null || rawMax !== null) {
    // Fall 1: Parser liefert nur max, Text sagt "über" → wir deuten es als Untergrenze
    // Beispiel: "über 800 Euro" → rawMin = null, rawMax = 800
    if (hasOverToken && rawMax !== null && rawMin === null) {
      rawMin = rawMax;
      rawMax = null;
    }

    // Fall 2: Parser liefert nur min, Text sagt "unter/bis" → wir deuten es als Obergrenze
    // Beispiel: "unter 25 Euro" → rawMin = 25, rawMax = null
    if (hasUnderToken && rawMin !== null && rawMax === null) {
      rawMax = rawMin;
      rawMin = null;
    }

    minPrice = rawMin;
    maxPrice = rawMax;
  } else {
    // Keine explizite Preisangabe → Intent steuert nur Sortierung, keine harten Filter
    minPrice = null;
    maxPrice = null;
  }

  // EFRO Budget-Fix:
  // - Track, ob nach Price-Filter keine Produkte gefunden wurden
  // - Unrealistische Budgets erkennen (unterhalb günstigstem / oberhalb teuerstem Produkt)
  let priceRangeNoMatch = false;
  let priceRangeInfo:
    | {
        userMinPrice: number | null;
        userMaxPrice: number | null;
        categoryMinPrice: number | null;
        categoryMaxPrice: number | null;
        category: string | null;
      }
    | undefined = undefined;

  if (minPrice !== null || maxPrice !== null) {
    const beforePriceFilter = candidates.length;

    candidates = candidates.filter((p) => {
      const price = p.price ?? 0;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });

    const candidateCountAfterPriceFilter = candidates.length;

    // Berechne Preis-Informationen für ehrliche Kommunikation
    const categoryForInfo = effectiveCategorySlug || contextCategory || null;
    let productsInCategory = categoryForInfo
      ? allProducts.filter(
          (p) => normalize(p.category || "") === categoryForInfo
        )
      : allProducts;

    if (!productsInCategory || productsInCategory.length === 0) {
      productsInCategory = allProducts;
    }

    const pricesInCategory = productsInCategory
      .map((p) => p.price ?? 0)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);

    const categoryMinPrice =
      pricesInCategory.length > 0 ? pricesInCategory[0] : null;
    const categoryMaxPrice =
      pricesInCategory.length > 0
        ? pricesInCategory[pricesInCategory.length - 1]
        : null;

    const unrealisticallyLow =
      maxPrice !== null &&
      categoryMinPrice !== null &&
      maxPrice < categoryMinPrice;

    const unrealisticallyHigh =
      minPrice !== null &&
      categoryMaxPrice !== null &&
      minPrice > categoryMaxPrice;

    const isGlobalBudgetOnly =
      !effectiveCategorySlug && !contextCategory;
    const isVeryLowGlobalBudget =
      isGlobalBudgetOnly && maxPrice !== null && maxPrice < 20;

    if (
      (candidateCountAfterPriceFilter === 0 && beforePriceFilter > 0) ||
      unrealisticallyLow ||
      unrealisticallyHigh ||
      isVeryLowGlobalBudget
    ) {
      priceRangeNoMatch = true;

      priceRangeInfo = {
        userMinPrice: minPrice,
        userMaxPrice: maxPrice,
        categoryMinPrice,
        categoryMaxPrice,
        category: categoryForInfo,
      };

      console.log("[EFRO SB] PRICE RANGE NO MATCH", {
        text: text.substring(0, 80),
        beforePriceFilter,
        afterPriceFilter: candidateCountAfterPriceFilter,
        priceRangeInfo,
        note:
          "Keine oder nur sehr unpassende Produkte im gewünschten Preisbereich gefunden.",
      });
    }

    console.log("[EFRO SB] AFTER PRICE FILTER", {
      text: text.substring(0, 80),
      minPrice,
      maxPrice,
      beforeCount: beforePriceFilter,
      afterCount: candidates.length,
      priceRangeNoMatch,
      samplePrices: candidates.slice(0, 5).map((p) => p.price ?? 0),
    });
  } else {
    console.log("[EFRO SB] PRICE FILTER SKIPPED", {
      text: text.substring(0, 80),
      reason: "no user price range",
      candidateCount: candidates.length,
    });
  }





  /**
   * 4) Fallback, wenn durch Filter alles weggefallen ist
   * EFRO Fix: Wenn genau 1 Produkt gefunden wurde, KEINE Fallback-Produkte beimischen
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
          // EFRO Fix: Bei priceRangeNoMatch nutze Kontext-Kategorie bevorzugt

          // EFRO Budget-Fix: Bei moderatem Budget-Mismatch KEIN Fallback,
          // sondern wirklich "kein Produkt im Preisbereich".
          if (
            priceRangeNoMatch &&
            priceRangeInfo &&
            priceRangeInfo.userMaxPrice !== null &&
            priceRangeInfo.categoryMinPrice !== null
          ) {
            const ratio =
              priceRangeInfo.categoryMinPrice / priceRangeInfo.userMaxPrice;

            // Beispiel:
            // - Haushalt 30 € vs. Kategorie-Min 34,5 € → ratio ≈ 1,15 (moderat)
            // - Wasserkocher 25 € vs. Kategorie-Min 34,5 € → ratio ≈ 1,38 (moderat)
            // - Jeans 6 € vs. Kategorie-Min ~40 € → ratio > 6 (extrem niedriges Budget)
            const isModeratelyLowBudget = ratio < 3; // alles <3 = "realistisch knapp drunter"

            if (isModeratelyLowBudget) {
              console.log(
                "[EFRO SB] Skipping product fallback due to moderate budget mismatch",
                {
                  text: text.substring(0, 80),
                  priceRangeInfo,
                  ratio,
                }
              );

              // In diesen Fällen (z. B. Haushalt bis 30 €, Wasserkocher bis 25 €)
              // sollen KEINE Produkte gezeigt werden – nur der spezielle Budget-Hinweis.
              return [];
            }
          }

          // Bisheriges Fallback-Verhalten:
          candidates = [...allProducts];

          // EFRO Fix: Bevorzuge effectiveCategorySlug (aus Kontext) für Fallback
          const fallbackCategory = effectiveCategorySlug || (matchedCategories.length > 0 ? matchedCategories[0] : null);
          
          if (fallbackCategory) {
            const byCat = candidates.filter((p) =>
              normalize(p.category || "") === fallbackCategory
            );
            if (byCat.length > 0) {
              candidates = byCat;
              console.log("[EFRO Filter Fallback] Using category from context/text", {
                category: fallbackCategory,
                count: candidates.length,
              });
            }
          } else if (matchedCategories.length > 0) {
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
    if (userMinPrice !== undefined && userMaxPrice === undefined) {
      // nur Untergrenze: günstigste über X zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      // Obergrenze / Range: teuer nach günstig
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

  // Spezialfall: User fragt explizit nach dem "günstigsten"/"billigsten"/"cheapest" Produkt
  const normalizedTextForCheapest = normalize(text);
  const wantsCheapestOne = /\b(günstigste(?:s|n)?|guenstigste(?:s|n)?|gunstigste(?:s|n)?|billigste(?:s|n)?|cheapest)\b/.test(
    normalizedTextForCheapest
  );

  if (!hasBudget && wantsCheapestOne && candidates.length > 0) {
    // Immer nach Preis aufsteigend sortieren und NUR das billigste Produkt zurücklassen
    candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    candidates = [candidates[0]];

    console.log("[EFRO SB] Cheapest-only shortcut", {
      text: text.substring(0, 80),
      intent: currentIntent,
      finalCount: candidates.length,
      cheapestPrice: candidates[0].price ?? null,
      cheapestTitle: candidates[0].title,
    });
  }

  // EFRO Fix: Wenn genau 1 Produkt gefunden wurde, KEINE Fallback-Produkte beimischen
  // Nur wenn candidateCount == 0: Fallback verwenden
  let finalProducts: EfroProduct[] = [];

  // Spezieller Fall: "günstigstes/billigstes Snowboard"
  // → Nur das preislich günstigste Produkt zurückgeben.
  const normalizedText = cleaned.toLowerCase();
  const wantsCheapestSnowboard =
    normalizedText.includes("snowboard") &&
    /\b(günstigstes|günstigste|günstigsten|billigste|billigsten|preiswerteste)\b/.test(
      normalizedText
    );

  if (wantsCheapestSnowboard && candidates.length > 0) {
    // Fokussiere zuerst auf Kategorie "snowboard", falls vorhanden
    const snowboardCandidates = candidates.filter(
      (p) => normalize(p.category || "") === "snowboard"
    );

    const baseList =
      snowboardCandidates.length > 0 ? snowboardCandidates : candidates;

    // Nach Preis aufsteigend sortieren und nur das günstigste Produkt zurückgeben
    baseList.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    const cheapest = baseList[0] ? [baseList[0]] : [];

    console.log("[EFRO SB] FINAL products (cheapest snowboard)", {
      text: text.substring(0, 80),
      candidateCount: candidates.length,
      cheapestPrice: cheapest[0]?.price ?? null,
      cheapestTitle: cheapest[0]?.title ?? null,
    });

    return cheapest;
  }
  
  if (candidates.length === 1) {
    // Genau 1 Treffer: Direkt verwenden, kein Fallback
    finalProducts = candidates;
    console.log("[EFRO SB] FINAL products (single match, no fallback)", {
      text: text.substring(0, 80),
      intent: currentIntent,
      finalCount: 1,
      product: {
        title: candidates[0].title.substring(0, 50),
        price: candidates[0].price ?? null,
        category: candidates[0].category ?? null,
      },
    });
  } else {
    // Mehrere oder keine Treffer: Normale Logik
    finalProducts = candidates.slice(0, 4);
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
  }

  return finalProducts;
}

/**
 * Ausschnitt aus der Produktbeschreibung
 */



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
  const hasBudget = minPrice !== undefined || maxPrice !== undefined;

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
    minPrice ?? null,
    maxPrice ?? null,
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
  aiTrigger?: SellerBrainAiTrigger,
  priceRangeNoMatch?: boolean,
  priceRangeInfo?: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  },
  missingCategoryHint?: string
): string {
  console.log("[EFRO ReplyText] mode='rule-based'", {
    intent,
    recommendedCount: recommended.length,
    priceRangeNoMatch,
    missingCategoryHint,
  });

  // EFRO Budget-Fix 2025-11-30 – PriceRangeNoMatch Reply: Ehrliche Kommunikation, wenn kein Produkt im gewünschten Preisbereich
  // WICHTIG: Bei priceRangeNoMatch NUR den speziellen Text zurückgeben, KEIN zusätzlicher Standard-Budget-Text
  if (priceRangeNoMatch && priceRangeInfo) {
    const { userMinPrice, userMaxPrice, categoryMinPrice, categoryMaxPrice, category } = priceRangeInfo;
    
    let priceRangeText = "";
    if (userMinPrice !== null && userMaxPrice === null) {
      priceRangeText = `über ${userMinPrice} €`;
    } else if (userMaxPrice !== null && userMinPrice === null) {
      priceRangeText = `unter ${userMaxPrice} €`;
    } else if (userMinPrice !== null && userMaxPrice !== null) {
      priceRangeText = `zwischen ${userMinPrice} € und ${userMaxPrice} €`;
    }
    
    const categoryLabel = category ? category : "Produkte";
    
    // EFRO Budget-Fix 2025-11-30: Sauberer, kurzer Text ohne zusätzliche Budget-Formulierungen
    let clarifyText = "";
    if (userMinPrice !== null && userMaxPrice === null) {
      // "über X" = Untergrenze, aber nichts gefunden
      if (categoryMinPrice !== null && categoryMaxPrice !== null) {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} über ${userMinPrice} €. Die vorhandenen ${categoryLabel} liegen zwischen ${categoryMinPrice.toFixed(2)} € und ${categoryMaxPrice.toFixed(2)} €. Wenn du möchtest, kann ich dir die günstigsten oder die Premium-Variante zeigen.`;
      } else {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} über ${userMinPrice} €. Wenn du möchtest, kann ich dir die verfügbaren Optionen zeigen.`;
      }
    } else if (userMaxPrice !== null && userMinPrice === null) {
      // "unter X" = Obergrenze, aber nichts gefunden
      if (categoryMinPrice !== null && categoryMaxPrice !== null) {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} unter ${userMaxPrice} €. Die vorhandenen ${categoryLabel} liegen zwischen ${categoryMinPrice.toFixed(2)} € und ${categoryMaxPrice.toFixed(2)} €. Wenn du möchtest, kann ich dir die günstigsten oder die Premium-Variante zeigen.`;
      } else {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} unter ${userMaxPrice} €. Wenn du möchtest, kann ich dir die verfügbaren Optionen zeigen.`;
      }
    } else {
      // Bereich oder allgemein
      if (categoryMinPrice !== null && categoryMaxPrice !== null) {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} im Preisbereich ${priceRangeText}. Die vorhandenen ${categoryLabel} liegen zwischen ${categoryMinPrice.toFixed(2)} € und ${categoryMaxPrice.toFixed(2)} €. Wenn du möchtest, kann ich dir die günstigsten oder die Premium-Variante zeigen.`;
      } else {
        clarifyText = `Im Shop gibt es keine ${categoryLabel} im Preisbereich ${priceRangeText}. Wenn du möchtest, kann ich dir die verfügbaren Optionen zeigen.`;
      }
    }
    
    console.log("[EFRO ReplyText PriceRangeNoMatch]", {
      priceRangeNoMatch,
      priceRangeInfo,
      clarifyTextLength: clarifyText.length,
      note: "Nur spezieller Text, kein zusätzlicher Standard-Budget-Text",
    });
    
    // EFRO Budget-Fix 2025-11-30: Direkt zurückgeben, KEIN zusätzlicher baseText
    return clarifyText;
  }

  // EFRO Budget-Fix 2025-11-30: Spezialfall: Fehlende Kategorie (z. B. "Bindungen" nicht im Katalog)
  if (missingCategoryHint) {
    const categoryLabel = missingCategoryHint;
    
    // EFRO S9 Fix: "pflege" soll auf "kosmetik" gemappt werden, nicht auf zufällige Kategorie
    const normalizedHint = normalize(categoryLabel);
    let alternativeCategory = recommended.length > 0 && recommended[0].category 
      ? recommended[0].category 
      : "Produkte";
    
    // Spezielle Fallback-Mappings für häufige Kategorien
    if (normalizedHint === "pflege" || normalizedHint.includes("pflege")) {
      // Prüfe, ob "kosmetik" im Katalog existiert
      const hasCosmetics = recommended.some((p) => 
        normalize(p.category || "").includes("kosmetik") || 
        normalize(p.category || "").includes("cosmetic")
      );
      if (hasCosmetics) {
        alternativeCategory = recommended.find((p) => 
          normalize(p.category || "").includes("kosmetik") || 
          normalize(p.category || "").includes("cosmetic")
        )?.category || alternativeCategory;
      }
    }
    
    const clarifyText = `In deinem Katalog finde ich nur ${alternativeCategory}, aber keine ${categoryLabel}. Ich zeige dir die ${alternativeCategory.toLowerCase()}.\n\n` +
      `Hinweis für den Shop-Betreiber: In deinem Katalog gibt es aktuell keine ${categoryLabel} – nur ${alternativeCategory} und Zubehör. ` +
      `Wenn du ${categoryLabel} verkaufen möchtest, solltest du entsprechende Produkte/Kategorien anlegen.`;
    
    console.log("[EFRO ReplyText MissingCategory]", {
      missingCategoryHint,
      alternativeCategory,
      clarifyTextLength: clarifyText.length,
    });
    
    // Wenn Produkte vorhanden sind, füge den Hinweis zum normalen Text hinzu
    if (recommended.length > 0) {
      const baseText = buildRuleBasedReplyText(text, intent, recommended);
      return `${clarifyText}\n\n${baseText}`;
    }
    
    return clarifyText;
  }

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

  // EFRO Budget-Fix 2025-01-XX: Spezialfall - Vages Budget ohne konkrete Zahl
  if (aiTrigger?.reason === "ambiguous_budget") {
    const clarifyText =
      `Du hast erwähnt, dass dein Budget eher klein ist. Damit ich dir wirklich passende Produkte empfehlen kann:\n\n` +
      `• Für welche Art von Produkt suchst du etwas (z. B. Snowboard, Haustier, Parfüm, Haushalt)?\n` +
      `• Und ungefähr mit welchem Betrag möchtest du rechnen?`;

    console.log("[EFRO ReplyText AmbiguousBudget]", {
      reason: aiTrigger.reason,
      clarifyTextLength: clarifyText.length,
    });

    return clarifyText;
  }

  // EFRO Budget-Fix 2025-01-XX: Spezialfall - Budget mit Zahl, aber ohne Kategorie
  if (aiTrigger?.reason === "missing_category_for_budget") {
    const clarifyText =
      `Alles klar, du hast ein Budget genannt. Für welche Art von Produkt suchst du etwas – ` +
      `z. B. Snowboard, Haustier-Produkte, Parfüm oder etwas für den Haushalt?`;

    console.log("[EFRO ReplyText MissingCategoryForBudget]", {
      reason: aiTrigger.reason,
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
  
  // Bindestrich oder Unterstrich enthalten (z. B. ABC-123, SNB-XL-RED, p-12345)
  const hasSpecial = /[-_]/.test(t);
  if (hasSpecial) return true;
  
  // Reine Buchstaben-Wörter (z. B. "hundefutter", "katzenfutter", "parfum") sind KEINE Codes
  // Nur Codes mit Ziffern oder Bindestrich/Unterstrich gelten als Produktcode
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
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : [],
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
  const previousRecommendedCount = previousRecommended ? previousRecommended.length : 0;
  
  console.log("[EFRO SellerBrain] explanationMode", {
    text: cleaned,
    explanationMode,
    previousCount: previousRecommendedCount,
  });

  // EFRO S18/S19 Fix: Handle Wax-Erklärungen mit AI-Trigger
  const waxExplanationInfo = handleWaxExplanation(
    cleaned,
    allProducts,
    explanationMode,
    previousRecommendedCount
  );

  // explanationMode ggf. übernehmen (für S18/S19)
  const effectiveExplanationMode = waxExplanationInfo.explanationMode || explanationMode;

  // EFRO Explanation-Mode: Erkennt Erklärungsanfragen und setzt AI-Trigger
  if (effectiveExplanationMode) {
    // EFRO Wax-Fall: Wenn keine Kategorie erkannt wird, suche nach "wachs"/"wax" in Produkten
    const normalized = normalize(cleaned);
    const hasCategoryFromQuery = CATEGORY_KEYWORDS && Object.values(CATEGORY_KEYWORDS).some((keywords) =>
      keywords.some((kw) => normalized.includes(kw.toLowerCase()))
    );
    
    let explanationProducts: EfroProduct[] = [];
    
    if (!hasCategoryFromQuery) {
      // Fallback: Suche nach "wachs" / "wax" in Titel/Beschreibung/Tags
      const waxRelatedProducts = allProducts.filter((p) => {
        const haystack = (
          (p.title ?? "") +
          " " +
          (p.description ?? "") +
          " " +
          (Array.isArray(p.tags) ? p.tags.join(" ") : "")
        ).toLowerCase();
        
        return haystack.includes("wachs") || haystack.includes("wax");
      });
      
      if (waxRelatedProducts.length > 0) {
        explanationProducts = waxRelatedProducts.slice(0, 3);
        console.log("[EFRO Explanation Wax] Wax-Produkte gefunden (keine Kategorie erkannt)", {
          text: cleaned,
          waxProductsCount: waxRelatedProducts.length,
          sampleTitles: explanationProducts.map((p) => p.title),
        });
      }
    }
    
    const recommended = previousRecommended
      ? previousRecommended.slice(0, maxRecommendations)
      : explanationProducts.length > 0
      ? explanationProducts
      : [];

    // EFRO WAX-Fix: Prüfe Beschreibung für Wax-Produkte
    // Nutze previousRecommended, wenn vorhanden (für Follow-up-Fragen)
    let hasUsableDescription = false;
    let waxProductWithDescription: EfroProduct | null = null;
    
    // Priorisiere previousRecommended für Follow-up-Fragen
    const productsToCheck = previousRecommended && previousRecommended.length > 0 
      ? previousRecommended 
      : recommended;
    
    if (productsToCheck.length > 0) {
      // Finde das beste Wax-Produkt (falls vorhanden)
      const waxProduct = productsToCheck.find((p) => {
        const haystack = ((p.title ?? "") + " " + (p.description ?? "")).toLowerCase();
        return haystack.includes("wax") || haystack.includes("wachs");
      }) || productsToCheck[0]; // Fallback: erstes empfohlenes Produkt
      
      if (waxProduct) {
        const desc = (waxProduct.description || "").trim();
        hasUsableDescription = desc.length >= 30; // Mindestens 30 Zeichen für sinnvolle Beschreibung
        waxProductWithDescription = hasUsableDescription ? waxProduct : null;
        
        console.log("[EFRO WAX Description Check]", {
          productTitle: waxProduct.title,
          descriptionLength: desc.length,
          hasUsableDescription,
          usingPreviousRecommended: previousRecommended && previousRecommended.length > 0,
        });
      }
    }

    // EFRO Explanation-Mode: AI-Trigger für Erklärungsanfragen setzen
    const matchedProductsForContext = recommended.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
    }));

    // EFRO Fix: KEIN AI-Trigger für Erklärungen mit Produktbeschreibung
    // Die Antwort wird direkt aus der Beschreibung generiert (siehe ReplyText-Logik unten)
    let aiTrigger: SellerBrainAiTrigger | undefined = undefined;

    // EFRO WAX-Fix: ReplyText direkt aus Produktbeschreibung generieren (ohne AI-Call)
    let replyText = "";
    if (productsToCheck.length > 0) {
      if (hasUsableDescription && waxProductWithDescription) {
        // Beschreibung vorhanden: Direkt aus Produktbeschreibung antworten
        const description = waxProductWithDescription.description || "";
        const productTitle = waxProductWithDescription.title || "dieses Produkt";
        
        // Extrahiere Schritte aus der Beschreibung (falls strukturiert)
        const steps = extractStepsFromDescription(description);
        
        if (steps.length > 0) {
          replyText = `Hier ist die Anleitung für ${productTitle}:\n\n` +
            steps.map((step: string, idx: number) => `${idx + 1}. ${step}`).join("\n");
        } else {
          // Fallback: Nutze Beschreibung direkt (gekürzt, falls zu lang)
          const maxLength = 500;
          const truncatedDesc = description.length > maxLength 
            ? description.substring(0, maxLength) + "..."
            : description;
          replyText = `Für ${productTitle}:\n\n${truncatedDesc}`;
        }
      } else {
        // Beschreibung fehlt: Ehrliche Antwort ohne AI
        replyText = "Für dieses Produkt liegt aktuell keine ausführliche Beschreibung im Shop vor. " +
          "Bitte wenden Sie sich direkt an den Shop oder schauen Sie später noch einmal vorbei.";
      }
    } else {
      replyText = "Ich kann dir gerne Fragen zu Inhaltsstoffen, Anwendung oder Pflege beantworten. " +
          "Dafür brauche ich aber ein konkretes Produkt. Bitte sage mir zuerst, welches Produkt dich interessiert, " +
          "dann kann ich dir die Details dazu erklären.";
    }

    console.log("[EFRO SellerBrain] Explanation mode – Direkt aus Beschreibung", {
      text: cleaned,
      explanationMode,
      previousCount: previousRecommended ? previousRecommended.length : 0,
      usedCount: recommended.length,
      maxRecommendations,
      hasCategoryFromQuery,
      waxProductsFound: explanationProducts.length > 0,
      hasUsableDescription,
      descriptionLength: waxProductWithDescription ? (waxProductWithDescription.description || "").length : 0,
      stepsExtracted: hasUsableDescription && waxProductWithDescription 
        ? extractStepsFromDescription(waxProductWithDescription.description || "").length 
        : 0,
    });

  return {
    intent: nextIntent,
    recommended,
    replyText,
    explanationMode: true,
    aiTrigger, // Nur setzen, wenn Beschreibung vorhanden
    // EFRO WAX-Fix: Debug-Flag für fehlende Beschreibung
    debugFlags: hasUsableDescription ? undefined : { missingDescription: true },
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
  const filterResult = filterProducts(
    cleaned,
    nextIntent,
    allProducts,
    context?.activeCategorySlug
  );
  const candidateCount = filterResult.length;

  // EFRO Budget-Fix 2025-11-30: Prüfe, ob nach Price-Filter keine Produkte
  // im gewünschten Preisbereich gefunden wurden – Budget-Parsing jetzt
  // zentral über analyzeBudget (gemeinsam mit filterProducts).
  const budgetAnalysis = analyzeBudget(cleaned);
  const {
    userMinPrice,
    userMaxPrice,
    hasBudgetWord,
    isBudgetAmbiguous,
  } = budgetAnalysis;

  const hasUserPriceRange =
    userMinPrice !== null || userMaxPrice !== null;
  
  // EFRO Budget-Fix 2025-01-XX: Bestimme effectiveCategorySlug für Budget-Prüfung
  let effectiveCategorySlug: string | null = null;
  if (context?.activeCategorySlug) {
    effectiveCategorySlug = normalize(context.activeCategorySlug);
  } else {
    // Versuche Kategorie aus Text zu extrahieren
    const normalized = normalize(cleaned);
    for (const [categorySlug, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => normalized.includes(kw.toLowerCase()))) {
        effectiveCategorySlug = categorySlug;
        break;
      }
    }
  }
  
  // EFRO Budget-Fix 2025-01-XX: Fall A - Vages Budget (z. B. "Ich habe ein kleines Budget.")
  // SCHRITT 1 FIX: Bei "Budget ohne Zahl" KEIN AI-Trigger, sondern regelbasierte Rückfrage
  if (isBudgetAmbiguous && hasBudgetWord && !hasUserPriceRange && !effectiveCategorySlug) {
    console.log("[EFRO SB Budget Ambiguous] Vages Budget erkannt, keine Produktempfehlungen, KEIN AI-Trigger", {
      text: cleaned.substring(0, 100),
      isBudgetAmbiguous,
      note: "Regelbasierte Rückfrage statt AI-Trigger",
    });
    
    // Regelbasierte Rückfrage direkt hier generieren (ohne AI-Trigger)
    const replyText =
      `Du hast erwähnt, dass dein Budget eher klein ist. Damit ich dir wirklich passende Produkte empfehlen kann:\n\n` +
      `• Für welche Art von Produkt suchst du etwas (z. B. Snowboard, Haustier, Parfüm, Haushalt)?\n` +
      `• Und ungefähr mit welchem Betrag möchtest du rechnen?`;
    
    return {
      intent: nextIntent,
      recommended: [],
      replyText,
      nextContext: context,
      // aiTrigger bleibt undefined → kein AI-Trigger
      priceRangeNoMatch: false,
    };
  }
  
      // EFRO Budget-Fix 2025-01-XX: Fall B - vages Budget ohne Zahl und ohne Kategorie
  // SCHRITT 1 FIX: Nur bei vagem Budget ohne Zahl + ohne Kategorie KEIN AI-Trigger,
  // sondern regelbasierte Rückfrage (z. B. "Ich habe ein kleines Budget.")
  if (isBudgetAmbiguous && hasBudgetWord && !hasUserPriceRange && !effectiveCategorySlug) {
    console.log("[EFRO SB Budget Missing Category] Vages Budget ohne Kategorie erkannt, keine Produktempfehlungen, KEIN AI-Trigger", {
      text: cleaned.substring(0, 100),
      hasBudgetWord,
      hasUserPriceRange,
      isBudgetAmbiguous,
      effectiveCategorySlug,
      note: "Regelbasierte Rückfrage statt AI-Trigger (vages Budget ohne Zahl)",
    });
    
    // KEIN AI-Trigger → aiTrigger bleibt undefined
    const replyText = buildReplyText(
      cleaned,
      nextIntent,
      [],
      undefined,
      false,
      undefined,
      undefined
    );
    
    return {
      intent: nextIntent,
      recommended: [],
      replyText,
      nextContext: context,
      // aiTrigger bleibt undefined → kein AI-Trigger
      priceRangeNoMatch: false,
    };
  }


  // EFRO Budget-Fix 2025-11-30: Prüfe, ob nach Price-Filter keine Produkte im gewünschten Preisbereich gefunden wurden
  let priceRangeNoMatch = false;
  let priceRangeInfo: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  } | undefined = undefined;
  
  // Prüfe, ob es eine konkrete Preisangabe gab, aber keine Produkte gefunden wurden
  // (nach Fallback könnten Produkte vorhanden sein, aber nicht im gewünschten Preisbereich)
  if (hasUserPriceRange) {
    // Prüfe, ob die gefundenen Produkte wirklich im Preisbereich liegen
    const productsInPriceRange = filterResult.filter((p) => {
      const price = p.price ?? 0;
      if (userMinPrice !== null && price < userMinPrice) return false;
      if (userMaxPrice !== null && price > userMaxPrice) return false;
      return true;
    });
    
    // Wenn keine Produkte im Preisbereich gefunden wurden, aber es eine Preisangabe gab
    if (productsInPriceRange.length === 0) {
      // Es gibt Produkte, aber nicht im gewünschten Preisbereich
      priceRangeNoMatch = true;
      
      // EFRO Budget-Fix 2025-11-30: Berechne Preis-Informationen für ehrliche Kommunikation
      // Bestimme die effektive Kategorie aus dem Kontext oder aus den gefilterten Produkten
      let effectiveCategorySlug: string | null = null;
      if (context?.activeCategorySlug) {
        effectiveCategorySlug = normalize(context.activeCategorySlug);
      } else if (filterResult.length > 0 && filterResult[0].category) {
        effectiveCategorySlug = normalize(filterResult[0].category);
      }
      
      const productsInCategory = effectiveCategorySlug
        ? allProducts.filter((p) => normalize(p.category || "") === effectiveCategorySlug)
        : allProducts;
      
      const pricesInCategory = productsInCategory
        .map((p) => p.price ?? 0)
        .filter((p) => p > 0)
        .sort((a, b) => a - b);
      
      const categoryMinPrice = pricesInCategory.length > 0 ? pricesInCategory[0] : null;
      const categoryMaxPrice = pricesInCategory.length > 0 ? pricesInCategory[pricesInCategory.length - 1] : null;
      
      priceRangeInfo = {
        userMinPrice: userMinPrice ?? null,
        userMaxPrice: userMaxPrice ?? null,
        categoryMinPrice,
        categoryMaxPrice,
        category: effectiveCategorySlug,
      };
      
      console.log("[EFRO SB] PRICE RANGE NO MATCH detected", {
        text: cleaned.substring(0, 100),
        userMinPrice,
        userMaxPrice,
        filterResultCount: filterResult.length,
        productsInPriceRangeCount: productsInPriceRange.length,
        priceRangeInfo,
        note: "Keine Produkte im gewünschten Preisbereich gefunden",
      });
    }
  }
  
  console.log("[EFRO SB] AFTER filterProducts", {
    userText: cleaned.substring(0, 100),
    intent: nextIntent,
    candidateCount,
    priceRangeNoMatch,
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
  const hasBudget = minPrice !== undefined || maxPrice !== undefined;

  // Erkennung: Budget vorhanden, aber hauptsächlich nur Budget-Keywords (keine Produkt-Keywords)
  const isBudgetOnly = hasBudget && (() => {
    const normalized = normalize(cleaned);
    const parsed = parseQueryForAttributes(cleaned);

    // Aus languageRules.de.ts
    const hasBudgetKeyword = BUDGET_KEYWORDS_FOR_SCENARIO.some((kw) =>
      normalized.includes(kw)
    );

    const hasProductKeywordFromConfig =
      PRODUCT_KEYWORDS_FOR_BUDGET_ONLY.some((kw) =>
        normalized.includes(kw)
      );

    // Harte Produkt-Wörter, damit "Snowboard", "Wasserkocher", "Smartphone", "Jeans" etc.
    // NICHT als reine Budget-Query gelten
    const HARD_PRODUCT_KEYWORDS = [
      "snowboard",
      "board",
      "wasserkocher",
      "kettle",
      "smartphone",
      "handy",
      "phone",
      "jeans",
      "hose",
      "t-shirt",
      "t shirt",
      "shirt",
      "parfum",
      "parfüm",
      "duft",
      "hund",
      "katze",
      "haustier",
    ];

    const hasProductKeywordFromHardList = HARD_PRODUCT_KEYWORDS.some((kw) =>
      normalized.includes(kw)
    );

    const hasProductKeyword =
      hasProductKeywordFromConfig || hasProductKeywordFromHardList;

    const noAttributes = parsed.attributeTerms.length === 0;

    const hasPureBudgetPhrase =
      hasBudgetKeyword && noAttributes && !hasProductKeyword;

    const hasNumberWithEuro =
      /\d+\s*(€|euro|eur)/i.test(normalized) &&
      noAttributes &&
      !hasProductKeyword;

    // Budget-only NUR wenn:
    // - Budget da
    // - KEINE klaren Produktwörter
    // - und entweder reine Budget-Phrase oder nur Zahl+Euro ohne Produkt
    return hasPureBudgetPhrase || (!hasBudgetKeyword && hasNumberWithEuro);
  })();

  if (isBudgetOnly && finalRanked.length > 2) {
    // Sortiere nach Preis (günstigste zuerst) und nehme die 2 günstigsten
    const sortedByPrice = [...finalRanked].sort(
      (a, b) => (a.price ?? 0) - (b.price ?? 0)
    );
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
    replyText = buildReplyText(cleaned, nextIntent, recommended, undefined, false, undefined, undefined);
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
      replyText = buildReplyText(cleaned, nextIntent, recommended);
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
  
  // EFRO: Sammle mögliche Produktcodes (z. B. "XY-9000") für AI-Trigger
  const possibleProductCodes: string[] = [];
  const tokens = normalizedText.split(/\s+/);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const hasLetters = /[a-z]/.test(lower);
    const hasDigits = /\d/.test(lower);
    
    if (hasLetters && hasDigits && looksLikeProductCode(lower)) {
      // Prüfe, ob Token NICHT durch bekannte Alias-/Kategorie-Maps abgedeckt ist
      const isKnown = CATEGORY_KEYWORDS && Object.values(CATEGORY_KEYWORDS).some((keywords) =>
        keywords.some((kw) => lower.includes(kw.toLowerCase()) || kw.toLowerCase().includes(lower))
      );
      
      if (!isKnown && !NON_CODE_TERMS_SET.has(lower)) {
        possibleProductCodes.push(lower);
      }
    }
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
    // EFRO Fix: Kategorie-Erkennung mit Wortgrenzen (verhindert "modern" -> "mode")
    allCategories.forEach((cat) => {
      if (cat) {
        // Verwende Wortgrenzen (\b) für exakte Matches, verhindert Substring-Matches
        const catRegex = new RegExp(`\\b${cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (catRegex.test(t)) {
          matchedCategories.push(cat);
          categoryHintsInText.push(cat);
        }
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
  // WICHTIG: hasBudgetWord wurde bereits oben aus budgetInfo destructured, hier nur für Logik verwenden
  const hasBudgetWordForCodeDetect =
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
    if (hasBudgetWordForCodeDetect || isBudgetOnly) {
      // Budget-Only-Query erkannt → unknownProductCodeOnly NICHT setzen
      unknownProductCodeOnly = false;
      console.log("[EFRO CodeDetect] Budget-Only-Query erkannt, CodeDetect blockiert", {
        text: cleaned,
        detectedCodeTerm,
        hasBudgetWord: hasBudgetWordForCodeDetect,
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
      // Prüfe, ob der Term wirklich wie ein Produktcode aussieht (Ziffern oder Bindestrich/Unterstrich)
      const isCodeLike = looksLikeProductCode(detectedCodeTerm);
      
      // Nur echte Code-Begriffe können unknownProductCodeOnly auslösen
      // Normale Wörter wie "hundefutter", "katzenfutter", "parfum" werden nicht als Code behandelt
      unknownProductCodeOnly = isCodeLike && !productCodeExistsInCatalog;
      
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
        isCodeLike: looksLikeProductCode(detectedCodeTerm),
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
          : isCodeLike
          ? "Code erkannt, aber blockiert (Kategorie/Alias/Budget)"
          : "Term erkannt, aber kein Code-Format (nur Buchstaben) → nicht als Code behandelt",
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
    // Reine Zahlen (Budget-Werte wie "20", "300", "10000") NICHT als unknownTerms behandeln
    .filter((t) => !/^\d+([.,]\d+)?$/.test(t))
    .filter((t) => !UNKNOWN_AI_STOPWORDS_SET.has(t));
  
  const filteredUnknownCount = filteredUnknownTerms.length;


  // AI-Trigger initialisieren
  let aiTrigger: SellerBrainAiTrigger | undefined = undefined;

  // EFRO S14 Fix: Prüfe frühzeitig auf unbekannte Produktcodes (vor Budget-Only-Check)
  // Diese sollen auch bei Budget-Only-Queries einen AI-Trigger auslösen
  let hasUnknownProductCode = false;
  let hasFressnapf = false;
  let unknownProductCodesForTrigger: string[] = [];
  
  // Prüfe possibleProductCodes
  if (possibleProductCodes.length > 0) {
    for (const code of possibleProductCodes) {
      const codeExists = allProducts.some((p) => {
        const fields: string[] = [];
        if (typeof (p as any).sku === "string") fields.push((p as any).sku);
        if (typeof (p as any).title === "string") fields.push((p as any).title);
        if (typeof (p as any).handle === "string") fields.push((p as any).handle);
        return fields.some((f) => f.toLowerCase().includes(code));
      });
      if (!codeExists) {
        unknownProductCodesForTrigger.push(code);
        hasUnknownProductCode = true;
      }
    }
  }
  
  // Prüfe auch detectedCodeTerm (wird später im CodeDetect-Block berechnet, hier vorbereiten)
  if (detectedCodeTerm) {
    const codeLc = detectedCodeTerm.toLowerCase();
    const productCodeExistsInCatalogForTrigger = allProducts.some((p) => {
      const fields: string[] = [];
      if (typeof (p as any).sku === "string") fields.push((p as any).sku);
      if (typeof (p as any).title === "string") fields.push((p as any).title);
      if (typeof (p as any).handle === "string") fields.push((p as any).handle);
      return fields.some((f) => f.toLowerCase().includes(codeLc));
    });
    if (!productCodeExistsInCatalogForTrigger) {
      hasUnknownProductCode = true;
    }
  }
  
  // EFRO Fressnapf-Fix: Prüfe, ob "fressnapf" in den unbekannten Begriffen ist
  hasFressnapf = filteredUnknownTerms.some((t) => 
    normalizeAliasKey(t) === "fressnapf" || t.toLowerCase().includes("fressnapf")
  );
  
  const hasUnknownBrandOrCode = hasUnknownProductCode || hasFressnapf;

  // SCHRITT 1 FIX: Prüfe auf "pure budget query ohne Zahl" (z. B. "Ich habe ein kleines Budget.")
  // Diese Logik sollte KEIN AI-Trigger setzen, sondern regelbasierte Rückfrage
  const hasNoNumber = userMinPrice === undefined && userMaxPrice === undefined;
  const isPureBudgetQuery = hasBudgetWord && hasNoNumber && !isProductRelated(cleaned);

  const hasContextCategory = !!(context && context.activeCategorySlug);

  // 1. Budget-Only-Queries: kein AI-Trigger, AUSSER es gibt unbekannte Produktcodes/Marken
  if (isBudgetOnly && hasContextCategory && !hasUnknownBrandOrCode && filteredUnknownCount === 0) {
    console.log("[EFRO SB AI-Trigger] Skipped for budget-only query (no unknown codes/brands)", {
      text: cleaned.substring(0, 100),
      finalCount,
      hasBudgetWord,
      isBudgetOnly,
      originalUnknownCount: aiUnknownTerms.length,
      filteredUnknownCount,
      hasUnknownProductCode,
      hasFressnapf,
      hasContextCategory,
    });
    // KEIN AI-Trigger → aiTrigger bleibt undefined
  } else if (isPureBudgetQuery) {
    // SCHRITT 1 FIX: Pure Budget-Query ohne Zahl → kein AI-Trigger
    console.log("[EFRO SB AI-Trigger] Skipped for pure budget-only query (clarify in replyText)", {
      text: cleaned.substring(0, 100),
      finalCount,
      hasBudgetWord,
      hasNoNumber,
      isProductRelated: isProductRelated(cleaned),
      note: "Regelbasierte Rückfrage statt AI-Trigger",
    });
    // KEIN AI-Trigger → aiTrigger bleibt undefined
  } else {
    // Restliche AI-Trigger-Entscheidungen kommen in diesen else-Block
    let needsAiHelp = false;
    let reason = "";

    const isGlobalBudgetOnly =
      isBudgetOnly &&
      !hasContextCategory &&
      !hasUnknownBrandOrCode &&
      filteredUnknownCount === 0;

    if (isGlobalBudgetOnly) {
      needsAiHelp = true;
      reason = "budget_only";
    } else {
      // Hilfsflags für AI-Trigger (wiederverwenden, falls bereits berechnet)
      const hasRecommendations = finalCount > 0;
      const hasEffectiveCategory =
        !!effectiveCategorySlugForCodeDetect ||
        (matchedCategories && matchedCategories.length > 0) ||
        (categoryHintsInText && categoryHintsInText.length > 0);
      // EFRO Fix: Erklärungs-Intent mit Produkt → KEINE AI
      // Die Antwort wird direkt aus der Produktbeschreibung generiert (wenn vorhanden)
      // oder ehrlich kommuniziert, dass keine Beschreibung vorhanden ist (ohne AI)
      const isExplanationIntent = effectiveExplanationMode !== null;
    
      if (isExplanationIntent && hasRecommendations) {
        // Erklärung + Produkt gefunden → KEINE AI
        needsAiHelp = false;
        reason = "";
        console.log("[EFRO SB AI-Trigger] Skipped for explanation with product match", {
          text: cleaned.substring(0, 100),
          explanationMode: effectiveExplanationMode,
          finalCount,
          hasRecommendations,
          note: "Antwort wird direkt aus Produktbeschreibung generiert, keine AI nötig",
        });
      } else {
        // Standard AI-Trigger-Logik für alle anderen Fälle
        
        // a) Code-Only-Unknown-Fall (soll bleiben)
        // 1.3) AI-Trigger „unknown_product_code_only" nur im echten Code-Only-Fall erlauben
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
          // EFRO Fix: Nur AI, wenn auch unbekannte Keywords vorhanden sind
          // synonymLookupTerms wird weiter unten definiert, daher hier nur filteredUnknownCount prüfen
          const hasUnknownKeywords = filteredUnknownCount > 0;
          if (hasUnknownKeywords) {
            needsAiHelp = true;
            reason = "no_results_with_unknown_keywords";
          } else {
            needsAiHelp = false;
            reason = "";
            console.log("[EFRO SB AI-Trigger] Skipped for no results without unknown keywords", {
              text: cleaned.substring(0, 100),
              finalCount,
              filteredUnknownCount,
              note: "Keine Produkte gefunden, aber auch keine unbekannten Keywords → keine AI",
            });
          }
        } else if (filteredUnknownCount > 0 && finalCount > 0) {
          // b) Low-Confidence-Unknown-Terms-Fall: Nur wenn gefilterte Unknown-Terms vorhanden
          needsAiHelp = true;
          reason = "low_confidence_unknown_terms";
        } else if (filteredUnknownCount >= 3) {
          needsAiHelp = true;
          reason = "many_unknown_terms";
        }
      }

      // EFRO: Verwende bereits berechnete unknownProductCodesForTrigger
      const unknownProductCodes = unknownProductCodesForTrigger.length > 0 
        ? unknownProductCodesForTrigger 
        : [];
      
      // EFRO: Prüfe auf unbekannte Begriffe für Synonym-Lookup (z. B. "fressnapf")
      // Diese Begriffe sind nicht in CATEGORY_KEYWORDS, nicht in statischen Synonym-Maps,
      // und nicht in Tag-/Titel-Treffern gefunden
      const synonymLookupTerms: string[] = [];
      if (filteredUnknownTerms.length > 0) {
        // Prüfe, ob Begriffe in dynamischen Synonymen vorhanden sind
        const dynamicSynonyms = getDynamicSynonyms();
        const dynamicSynonymTerms = new Set(dynamicSynonyms.map((s) => s.term.toLowerCase()));
        
        for (const term of filteredUnknownTerms) {
          // Wenn Begriff nicht in dynamischen Synonymen und nicht wie ein Produktcode aussieht
          if (!dynamicSynonymTerms.has(term) && !looksLikeProductCode(term)) {
            // Prüfe, ob Begriff in Produkten gefunden wurde
            const foundInProducts = allProducts.some((p) => {
              const searchText = `${p.title} ${p.description} ${(p.tags || []).join(" ")}`.toLowerCase();
              return searchText.includes(term);
            });
            
            if (!foundInProducts) {
              synonymLookupTerms.push(term);
            }
          }
        }
      }
      
      // EFRO: Setze AI-Trigger für unknown_product_code / unknown_product_code_with_budget, wenn Codes gefunden wurden
      if (unknownProductCodes.length > 0 && !needsAiHelp) {
        needsAiHelp = true;

        // Prüfe, ob der Nutzer tatsächlich ein Budget angegeben hat
        const hasUserBudget =
          (userMinPrice !== undefined && !Number.isNaN(userMinPrice)) ||
          (userMaxPrice !== undefined && !Number.isNaN(userMaxPrice));

        if (!isBudgetOnly && hasUserBudget) {
          // Spezialfall S14: Kombination aus unbekanntem Code + Budget
          reason = "unknown_product_code_with_budget";
        } else {
          reason = "unknown_product_code";
        }
      }
      
      // EFRO: Setze AI-Trigger für synonym_lookup, wenn unbekannte Begriffe gefunden wurden
      if (synonymLookupTerms.length > 0 && !needsAiHelp && finalCount === 0) {
        needsAiHelp = true;
        reason = "synonym_lookup";
      }


      if (needsAiHelp) {
        aiTrigger = {
          needsAiHelp: true,
          reason,
          unknownTerms: reason === "unknown_product_code_only" || reason === "unknown_product_code" ? [] : filteredUnknownTerms,
          queryForAi: cleaned,
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
        
        // EFRO: Setze unknownProductCodes, falls vorhanden
        if (unknownProductCodesForTrigger.length > 0) {
          aiTrigger.unknownProductCodes = unknownProductCodesForTrigger;
        }
        
        // EFRO Fressnapf-Fix: Setze unknownTerms für "fressnapf" als unbekannte Marke
        if (hasFressnapf) {
          const fressnapfTerms = filteredUnknownTerms.filter((t) => 
            normalizeAliasKey(t) === "fressnapf" || t.toLowerCase().includes("fressnapf")
          );
          if (fressnapfTerms.length > 0) {
            aiTrigger.unknownTerms = [...(aiTrigger.unknownTerms || []), ...fressnapfTerms];
          }
        }
        
        // EFRO S14 Fix: Bei Budget + unbekanntem Code, füge Code zu unknownTerms hinzu
        if ((reason === "unknown_product_code_with_budget" || reason === "unknown_product_code") && 
            unknownProductCodesForTrigger.length > 0) {
          aiTrigger.unknownTerms = [...(aiTrigger.unknownTerms || []), ...unknownProductCodesForTrigger];
        }
        
        // EFRO: Setze unknownTerms für synonym_lookup
        if (reason === "synonym_lookup" && synonymLookupTerms.length > 0) {
          aiTrigger.unknownTerms = synonymLookupTerms;
        }
        
        // EFRO Fressnapf-Fix: Setze termExplainRequests für unbekannte Begriffe
        if (filteredUnknownTerms.length > 0 && (reason === "unknown_term_expansion" || reason === "low_confidence_unknown_terms" || reason === "synonym_lookup")) {
          aiTrigger.termExplainRequests = filteredUnknownTerms.map((term) => ({
            term,
            purpose: "category_guess" as const,
          }));
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
	
      // EFRO Budget-Fix 2025-12-XX: AI-Trigger für unrealistische Budgets / keinen Treffer im Preisbereich
      // Falls priceRangeNoMatch gesetzt ist, aber bisher kein anderer AI-Trigger existiert,
      // signalisieren wir der AI, dass sie helfen soll, das Budget sinnvoll einzuordnen.
      if (!aiTrigger && priceRangeNoMatch) {
        aiTrigger = {
          needsAiHelp: true,
          reason: "price_range_no_match",
          queryForAi: cleaned,
        };

        console.log("[EFRO SB AI-Trigger] Set for price_range_no_match", {
          text: cleaned.substring(0, 100),
          priceRangeNoMatch,
          priceRangeInfo,
          userMinPrice,
          userMaxPrice,
          finalCount,
          note: "Unrealistischer oder leerer Preisbereich → AI soll Budget erklären/helfen",
        });
      }
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
  // WICHTIG: effectiveCategorySlug wurde bereits oben deklariert (Zeile 4425), hier nur überschreiben wenn nötig
  if (recommended.length > 0 && recommended[0].category) {
    effectiveCategorySlug = normalize(recommended[0].category);
  } else if (context?.activeCategorySlug && !effectiveCategorySlug) {
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
  // WICHTIG:
  // - Nur wenn es KEINE Budget-Only-Query ist
  // - UND KEIN erfolgreicher AliasMatch vorhanden ist
  // - UND nach der Ranking-Phase wirklich KEINE Produkte übrig sind (finalCount === 0)
  //
  // Wenn trotz unbekanntem Produktcode noch Produkte gefunden wurden (finalCount > 0),
  // sollen diese weiterhin angezeigt werden. In diesem Fall wird NUR der AI-Trigger
  // verwendet, um den unbekannten Begriff zu klären – die Empfehlungen bleiben erhalten.
  if (
    aiTrigger?.reason === "unknown_product_code_only" &&
    !hasBudgetWord &&
    !isBudgetOnly &&
    !aliasMatchSuccessful
  ) {
    if (finalCount === 0) {
      // Nur in diesem Fall wirklich alles verwerfen
      recommended = [];
      console.log("[EFRO SB] Produkte verworfen (unknown_product_code_only, kein AliasMatch, finalCount=0)", {
        text: cleaned.substring(0, 100),
        reason: aiTrigger.reason,
        aliasMatchSuccessful,
        candidateCountAfterAlias,
        finalCount,
      });
    } else {
      // Es wurden trotzdem sinnvolle Produkte gefunden → NICHT verwerfen
      console.log("[EFRO SB] Produkte NICHT verworfen (unknown_product_code_only, aber finalCount > 0)", {
        text: cleaned.substring(0, 100),
        reason: aiTrigger.reason,
        aliasMatchSuccessful,
        candidateCountAfterAlias,
        finalCount,
        recommendedCount: recommended.length,
      });
    }
  } else if (aiTrigger?.reason === "unknown_product_code_only" && aliasMatchSuccessful) {
    console.log("[EFRO SB] Produkte NICHT verworfen (unknown_product_code_only, aber AliasMatch erfolgreich)", {
      text: cleaned.substring(0, 100),
      reason: aiTrigger.reason,
      aliasMatchSuccessful,
      candidateCountAfterAlias,
      recommendedCount: recommended.length,
    });
  }

  // EFRO Budget-Fix 2025-11-30: Prüfe auf fehlende Kategorie (z. B. "Bindungen" nicht im Katalog)
  let missingCategoryHint: string | undefined = undefined;
  const categoryHintsFromText = collectMatches(normalize(cleaned).toLowerCase(), CATEGORY_KEYWORDS);
  if (categoryHintsFromText.length > 0) {
    const firstHint = categoryHintsFromText[0];
    const normalizedHint = normalize(firstHint);
    const allCategories = Array.from(
      new Set(
        allProducts
          .map((p) => normalize(p.category || ""))
          .filter((c) => c.length >= 3)
      )
    );
    const existsInCatalog = allCategories.some((cat) => normalize(cat) === normalizedHint);
    if (!existsInCatalog) {
      missingCategoryHint = firstHint;
      console.log("[EFRO SB] Missing category hint detected in runSellerBrain", {
        text: cleaned.substring(0, 100),
        missingCategoryHint,
        note: "Kategorie im Text erkannt, aber nicht im Katalog vorhanden",
      });
    }
  }

  // Reply-Text mit AI-Klärung neu generieren, falls aiTrigger vorhanden
  // EFRO Budget-Fix 2025-11-30: priceRangeNoMatch hat Priorität vor AI-Trigger
  let finalReplyText = replyText;
  if (priceRangeNoMatch) {
    finalReplyText = buildReplyText(cleaned, nextIntent, recommended, aiTrigger, priceRangeNoMatch, priceRangeInfo, missingCategoryHint);
  } else if (aiTrigger?.needsAiHelp || missingCategoryHint) {
    finalReplyText = buildReplyText(cleaned, nextIntent, recommended, aiTrigger, priceRangeNoMatch, priceRangeInfo, missingCategoryHint);
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

  // EFRO Haustier-Fallback:
  // Wenn Kategorie-Kontext Haustier/Tierbedarf ist, aber noch keine Produkte empfohlen wurden,
  // wähle ein paar sinnvolle Haustier-Produkte aus dem Katalog.
  const normalizedQuery = normalize(cleaned || userText || "");

  const looksLikePetQuery =
    normalizedQuery.includes("haustier") ||
    normalizedQuery.includes("tierbedarf") ||
    normalizedQuery.includes("hund") ||
    normalizedQuery.includes("katze") ||
    normalizedQuery.includes("tier");

  const effectiveCategoryName = effectiveCategorySlug
    ? normalize(effectiveCategorySlug)
    : "";

  if (
    recommended.length === 0 &&
    looksLikePetQuery &&
    (effectiveCategoryName === "haustier" ||
      effectiveCategoryName === "tierbedarf")
  ) {
    // Suche nach Haustier-Produkten im gesamten Katalog
    const petFallback = allProducts.filter((p) => {
      const cat = normalize(p.category || "");
      const title = normalize(p.title || "");
      const desc = normalize(p.description || "");

      const isPetCategory =
        cat === "haustier" ||
        cat === "tierbedarf";

      const mentionsPet =
        title.includes("hund") ||
        title.includes("katze") ||
        title.includes("tier") ||
        desc.includes("hund") ||
        desc.includes("katze") ||
        desc.includes("tier");

      return isPetCategory || mentionsPet;
    });

    if (petFallback.length > 0) {
      // Für Premium-Anfragen: teuerste Haustierprodukte zuerst
      const sorted = [...petFallback].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      // Begrenze auf z.B. 3 Produkte
      recommended = sorted.slice(0, 3);
      console.log("[EFRO SB Haustier-Fallback] Applied", {
        query: normalizedQuery,
        effectiveCategoryName,
        count: recommended.length,
      });
    }
  }

  console.log("[EFRO SB RETURN]", {
    text: cleaned,
    intent: nextIntent,
    finalCount: recommended.length,
    replyText: finalReplyText,
    replyTextLength: finalReplyText.length,
    aiTrigger,
    nextContext,
    priceRangeNoMatch,
    priceRangeInfo,
  });

  return {
    intent: nextIntent,
    recommended: recommended || [],
    replyText: finalReplyText,
    nextContext,
    aiTrigger,
    priceRangeNoMatch: priceRangeNoMatch || undefined,
    priceRangeInfo: priceRangeInfo || undefined,
    missingCategoryHint: missingCategoryHint || undefined,
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

 

// ============================================================================
// SELLERBRAIN V2: Wrapper mit Supabase-Repository & Antwort-Cache
// ============================================================================

/**
 * Optionen für runSellerBrainV2
 */
export interface RunSellerBrainV2Options {
  shopDomain: string; // z.B. 'test-shop.myshopify.com' oder 'demo'
  locale?: string; // default 'de'
  useCache?: boolean; // default true
}

/**
 * Ergebnis von runSellerBrainV2 (erweitert SellerBrainResult um Cache-Flag)
 */
export interface SellerBrainV2Result extends SellerBrainResult {
  fromCache?: boolean;
}

/**
 * Einfache, deterministische Hash-Funktion für Frage-Text.
 * Verwendet FNV-1a Algorithmus (32-bit), keine externen Abhängigkeiten.
 */
function hashQuestion(text: string): string {
  const str = text.trim().toLowerCase();
  let hash = 2166136261; // FNV offset basis (32-bit)

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  // Konvertiere zu hexadezimaler String (immer 8 Zeichen)
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Baut ein SellerBrainResult aus einem gecachten Response.
 * Mappt cached.products (IDs + Basisdaten) zurück zu EfroProduct[].
 */
function buildResultFromCache(
  cached: EfroCachedResponse,
  allProducts: EfroProduct[]
): SellerBrainResult {
  // Versuche, Produkte aus allProducts anhand der IDs in cached.products zu finden
  let recommended: EfroProduct[] = [];

  if (cached.products && Array.isArray(cached.products)) {
    // cached.products kann IDs oder vollständige Produkt-Objekte enthalten
    recommended = cached.products
      .map((cachedProduct: any) => {
        // Wenn es ein vollständiges Produkt-Objekt ist, verwende es direkt
        if (cachedProduct.id && cachedProduct.title) {
          return cachedProduct as EfroProduct;
        }
        // Wenn es nur eine ID ist, suche in allProducts
        if (typeof cachedProduct === "string") {
          return allProducts.find((p) => p.id === cachedProduct);
        }
        // Wenn es ein Objekt mit id-Feld ist
        if (cachedProduct.id) {
          return allProducts.find((p) => p.id === cachedProduct.id);
        }
        return null;
      })
      .filter((p): p is EfroProduct => p !== null && p !== undefined);
  }

  // Fallback: Wenn keine Produkte gefunden, leere Liste
  if (recommended.length === 0) {
    recommended = [];
  }

  // Default-Intent (kann aus Cache erweitert werden, falls nötig)
  const intent: ShoppingIntent = "explore";

  return {
    intent,
    recommended,
    replyText: cached.replyText || "",
    // Optional: Weitere Felder aus Cache rekonstruieren, falls vorhanden
    aiTrigger: undefined,
    priceRangeNoMatch: undefined,
    priceRangeInfo: undefined,
    missingCategoryHint: undefined,
    explanationMode: undefined,
    debugFlags: undefined,
  };
}

/**
 * Kürzt SellerBrain-ReplyTexte für das UI:
 * - Entfernt den Klarstellungs-Block "Einige deiner Begriffe ..."
 *   (AI-Clarify-Teil), der am Ende angehängt wird.
 * - Lässt den produktbezogenen Teil unverändert.
 */
function trimClarifyBlock(replyText: string | null | undefined): string {
  if (!replyText) return "";

  const marker = "Einige deiner Begriffe kann ich im Katalog nicht zuordnen";

  const idx = replyText.indexOf(marker);
  if (idx === -1) {
    // Kein Klarstellungs-Block -> Text unverändert zurückgeben
    return replyText.trim();
  }

  // Nur den Teil vor dem Marker behalten
  return replyText.slice(0, idx).trim();
}

/**
 * SellerBrain v2: Wrapper mit Supabase-Repository & Antwort-Cache.
 *
 * - Lädt Shop und Produkte aus Supabase
 * - Prüft Cache für bereits beantwortete Fragen
 * - Ruft intern runSellerBrain (v1) als Engine auf
 * - Speichert Antworten im Cache
 * - Kürzt ReplyText für UI (entfernt Klarstellungs-Blöcke bei Produktempfehlungen)
 *
 * @param userText - Benutzer-Frage
 * @param allProducts - Fallback-Produktliste (wird verwendet, wenn Supabase leer ist)
 * @param sellerContext - SellerBrain-Kontext (optional)
 * @param options - Optionen (shopDomain, locale, useCache)
 * @returns SellerBrainV2Result mit fromCache-Flag
 */
export async function runSellerBrainV2(
  userText: string,
  allProducts: EfroProduct[],
  sellerContext: SellerBrainContext | undefined,
  options: RunSellerBrainV2Options
): Promise<SellerBrainV2Result> {
  const { shopDomain, locale = "de", useCache = true } = options;

  console.log("[EFRO SB V2] ENTER", {
    shopDomain,
    locale,
    useCache,
    userTextLength: userText.length,
  });

  // 1) Shop laden
  let shop = await getEfroShopByDomain(shopDomain);
  if (!shop) {
    console.log("[EFRO SB V2] Shop nicht gefunden, versuche Demo-Shop");
    shop = await getEfroDemoShop();
  }

  if (!shop) {
    console.warn("[EFRO SB V2] Kein Shop gefunden, verwende Fallback-Produkte");
    // Fallback: Verwende allProducts direkt und rufe v1 auf
    const result = runSellerBrain(
      userText,
      "explore",
      allProducts,
      undefined,
      undefined,
      sellerContext
    );
    return {
      ...result,
      fromCache: false,
    };
  }

  // 2) Produkte für diesen Shop laden
  const shopProductsResult = await getProductsForShop(shop);

  // Verwende shopProducts, falls vorhanden, sonst Fallback zu allProducts
  const productsToUse = shopProductsResult.products.length > 0 ? shopProductsResult.products : allProducts;

  console.log("[EFRO SB V2] Products loaded", {
    shopId: shop.id,
    shopProductsCount: shopProductsResult.products.length,
    shopProductsSource: shopProductsResult.source,
    fallbackProductsCount: allProducts.length,
    finalProductsCount: productsToUse.length,
    sample: productsToUse.slice(0, 5).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
    })),
  });

  // 3) Frage normalisieren & hashen
  const normalizedText = userText.trim().toLowerCase();
  const questionHash = hashQuestion(normalizedText);

  // 4) Cache checken
  if (useCache && shop.id) {
    const cached = await getCachedResponse({
      shopId: shop.id,
      questionHash,
      locale,
    });

    if (cached) {
      console.log("[EFRO SB V2] Using cache", {
        shopId: shop.id,
        questionHash,
        hitCount: cached.hitCount,
      });

      // Produkte aus cached.products wiederverwenden
      const result = buildResultFromCache(cached, productsToUse);

      // UI-Postprocessing: Klarstellungs-Block entfernen, wenn Produkte vorhanden
      let uiReplyText = result.replyText;
      let uiAiTrigger = result.aiTrigger;
      const hasProducts = result.recommended && result.recommended.length > 0;

      if (hasProducts) {
        const originalText = result.replyText || "";
        uiReplyText = trimClarifyBlock(originalText);
        const hadClarifyBlock = originalText.includes(
          "Einige deiner Begriffe kann ich im Katalog nicht zuordnen"
        );

        // Wenn Klarstellungsblock entfernt wurde, aiTrigger entschärfen
        if (hadClarifyBlock) {
          uiAiTrigger = undefined;
        }
      }

      const uiResult: SellerBrainV2Result = {
        ...result,
        replyText: uiReplyText,
        aiTrigger: uiAiTrigger,
        fromCache: true,
      };

      console.log("[EFRO SB V2] Result", {
        fromCache: true,
        replyTextLength: uiResult.replyText?.length ?? 0,
        recommendedCount: uiResult.recommended?.length ?? 0,
      });

      return uiResult;
    }
  }

  console.log("[EFRO SB V2] Miss -> calling v1", {
    shopId: shop.id,
    questionHash,
  });

  // 5) SellerBrain v1 aufrufen
  // Default-Intent: "explore" (kann später erweitert werden)
  const sbResult = runSellerBrain(
    userText,
    "explore",
    productsToUse,
    shop.currency || undefined,
    undefined,
    sellerContext
  );

  // 6) UI-Postprocessing: Klarstellungs-Block entfernen, wenn Produkte vorhanden
  let uiReplyText = sbResult.replyText;
  let uiAiTrigger = sbResult.aiTrigger;
  const hasProducts = sbResult.recommended && sbResult.recommended.length > 0;

  if (hasProducts) {
    const originalText = sbResult.replyText || "";
    uiReplyText = trimClarifyBlock(originalText);
    const hadClarifyBlock = originalText.includes(
      "Einige deiner Begriffe kann ich im Katalog nicht zuordnen"
    );

    // Wenn Klarstellungsblock entfernt wurde, aiTrigger entschärfen
    if (hadClarifyBlock) {
      uiAiTrigger = undefined;
    }
  }

  // 7) Cache schreiben (wenn sinnvolle Antwort)
  // WICHTIG: Original-ReplyText im Cache speichern (nicht den gekürzten)
  if (
    useCache &&
    shop.id &&
    sbResult.replyText &&
    sbResult.replyText.trim().length > 0
  ) {
    // Speichere empfohlene Produkte (IDs + Basisdaten)
    const productsToCache = sbResult.recommended.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: p.price,
      category: p.category,
      imageUrl: p.imageUrl,
    }));

    await upsertCachedResponse({
      shopId: shop.id,
      questionHash,
      questionText: userText,
      locale,
      replyText: sbResult.replyText, // Original-Text im Cache
      products: productsToCache,
    });
  }

  const uiResult: SellerBrainV2Result = {
    ...sbResult,
    replyText: uiReplyText,
    aiTrigger: uiAiTrigger,
    fromCache: false,
  };

  console.log("[EFRO SB V2] Result", {
    fromCache: false,
    replyTextLength: uiResult.replyText?.length ?? 0,
    recommendedCount: uiResult.recommended?.length ?? 0,
  });

  return uiResult;
}

/**
 * ============================================================================
 * DOKUMENTATION: SellerBrain v2
 * ============================================================================
 *
 * runSellerBrainV2 ist ein Wrapper um runSellerBrain (v1), der:
 * - Supabase-Repository (efroSupabaseRepository) verwendet
 * - Einen Antwort-Cache in cache_responses nutzt
 * - Intern weiterhin runSellerBrain (v1) als Engine verwendet
 *
 * WICHTIG:
 * - runSellerBrain (v1) bleibt unverändert und ist die eigentliche Engine
 * - Avatar-, TTS- und UI-Code werden NICHT angefasst
 * - Nur neue Funktion + klar dokumentierter Export
 *
 * Vorausgesetzte Supabase-Tabellen:
 * - efro_shops: Shop-Metadaten (shop_domain, id, etc.)
 * - products / products_demo: Produktkatalog
 * - cache_responses: Antwort-Cache (shop_id, question_hash, question_text, reply_text, products, locale, hit_count, created_at, last_used_at)
 *   - WICHTIG: Unique Constraint auf (shop_id, question_hash, locale) erforderlich
 *
 * Verwendung:
 * ```ts
 * const result = await runSellerBrainV2(
 *   "Zeige mir Hundebetten",
 *   fallbackProducts,
 *   undefined,
 *   { shopDomain: "demo", locale: "de", useCache: true }
 * );
 * ```
 *
 * ============================================================================
 */








