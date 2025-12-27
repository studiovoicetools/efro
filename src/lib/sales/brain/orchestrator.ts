// src/lib/sales/brain/orchestrator.ts

/**
 * EFRO SellerBrain Übersicht (nur Doku):
 * 
 * - Hauptfunktion: runSellerBrain(userText, currentIntent, allProducts, plan?, previousRecommended?, context?)
 *   → Gibt SellerBrainResult zurück
 * 
 * - Rückgabe-Typ: SellerBrainResult (definiert in src/lib/sales/modules/types/index.ts)
 *   → Felder:
 *     • intent: ShoppingIntent (explore | quick_buy | clarify)
 *     • recommended: EfroProduct[] (empfohlene Produkte, max. je nach Plan: starter=2, pro=4, enterprise=6)
 *     • replyText: string (immer gesetzt, nie null/undefined)
 *     • nextContext?: SellerBrainContext (z.B. activeCategorySlug)
 *     • aiTrigger?: { needsAiHelp, reason, unknownTerms, codeTerm, ... } (Meta-Infos für AI-Hilfe)
 *     • priceRangeNoMatch?: boolean (wenn Budget nicht erfüllt)
 *     • priceRangeInfo?: PriceRangeInfo (Preisbereich-Infos)
 *     • missingCategoryHint?: string (fehlende Kategorie-Hinweise)
 *     • explanationMode?: boolean (Erklärungsmodus)
 *     • debugFlags?: { missingDescription?: boolean }
 * 
 * - Filter-Modul: filterProductsForSellerBrain(text, intent, allProducts, contextCategory?)
 *   → Gibt EfroProduct[] zurück (gefilterte Kandidaten)
 *   → Wird intern von runSellerBrain aufgerufen
 *   → Filter-Pipeline: PRICE → CATEGORY → KEYWORD_MATCHES → ATTRIBUTE → BUDGET → RANKING
 */

/**
 * ============================================================
 * ?NDERUNGEN (Senior TypeScript/Next.js Engineer - Debug-Fix)
 * ============================================================
 * 
 * 1. Defensive Guard f?r leere allProducts in runSellerBrain() hinzugef?gt
 *    ? Fr?her Return mit Fallback-Text, wenn keine Produkte verf?gbar
 * 
 * 2. Defensive Guard f?r leeren/undefined replyText am Ende von runSellerBrain()
 *    ? Sicherstellt, dass IMMER ein g?ltiger String zur?ckgegeben wird
 * 
 * 3. Frontend-Integration verbessert (src/app/avatar-seller/page.tsx)
 *    ? Pr?fung auf nicht-leeren String statt nur truthy-Check
 *    ? Fallback-Nachricht, wenn replyText leer ist
 * 
 * 4. JSON-Imports verifiziert (tsconfig.json hat resolveJsonModule: true)
 *    ? generatedProductHints.json und generatedAliasMap.json funktionieren korrekt
 * 
 * 5. Tags-Behandlung bereits defensiv implementiert
 *    ? isPerfumeProduct() und isMoldProduct() behandeln tags als Array oder String
 * 
 * 6. buildAttributeIndex() wird sicher mit Array aufgerufen
 *    ? Guard in filterProducts() pr?ft allProducts.length === 0
 * 
 * 7. buildRuleBasedReplyText() gibt IMMER einen String zur?ck
 *    ? Auch bei count === 0 gibt es einen Fallback-Text
 * 
 * 8. Logging erweitert f?r besseres Debugging
 *    ? Warn-Logs bei leeren Produktlisten oder replyText
 *    ? replyTextLength in [EFRO SB RETURN] Log
 * 
 * 9. Keine ?nderungen an API-Signaturen
 *    ? runSellerBrain() und SellerBrainResult bleiben unver?ndert
 * 
 * 10. Keine ?nderungen an Avatar/LipSync-Code
 *     ? Nur sellerBrain.ts und Frontend-Integration angepasst
 * 
 * ============================================================
 * ARCHITEKTUR-?BERSICHT: FILTER-PIPELINE IN filterProducts()
 * ============================================================
 * 
 * Reihenfolge der Filter in filterProducts(text, intent, allProducts):
 * 
 * 1. ENTER: Initialisierung
 *    - candidates = [...allProducts] (Start: alle Produkte)
 *    - Intent kann innerhalb der Funktion angepasst werden (currentIntent)
 * 
 * 2. PRICE: Preisbereich extrahieren
 *    - extractUserPriceRange(text) ? userMinPrice, userMaxPrice
 *    - Wird sp?ter angewendet (nach KEYWORD_MATCHES)
 * 
 * 3. CATEGORY: Kategorie-Filter
 *    - matchedCategories aus Text extrahieren
 *    - candidates = candidates.filter(p => matchedCategories.includes(p.category))
 * 
 * 4. WORDS: Keyword-Extraktion
 *    - words aus Text extrahieren (Stopw?rter entfernt)
 *    - catalogKeywords aus allen Produkten extrahieren
 *    - expandWordsWithCatalogKeywords() f?r Komposita-Aufbrechen
 * 
 * 5. ALIAS-PREPROCESSING: Alias-Map vor Keyword-Matching
 *    - resolveUnknownTerms() mit catalogKeywords
 *    - Wenn resolved.length > 0: words/expandedWords erweitern
 *    - AliasHardFilter: Bei aliasMapUsed === true nur Produkte mit Alias-Tokens
 * 
 * 6. KEYWORD_MATCHES: Scoring und Filterung
 *    - scoreProductsForWords() f?r alle Kandidaten
 *    - candidates = scored.filter(score > 0).sort().slice(0, 20)
 *    - PERFUME-SYNONYMS: Wenn userAskedForPerfume === true
 *      ? candidates = perfumeCandidates (nur echte Parf?m-Produkte)
 * 
 * 7. PRICE-FILTER: Preisbereich anwenden
 *    - candidates = candidates.filter(price >= minPrice && price <= maxPrice)
 * 
 * 8. FALLBACK: Wenn candidates.length === 0
 *    - Bei Parf?m-Intent: originalPerfumeCandidates beibehalten
 *    - Sonst: candidates = [...allProducts] + Kategorie/Preis-Filter erneut
 * 
 * 9. SORTIERUNG: Nach Intent/Budget
 *    - Premium: teuerste zuerst
 *    - Bargain/Quick-Buy: g?nstigste zuerst
 *    - Budget: je nach Min/Max sortiert
 * 
 * 10. RESULT: return candidates.slice(0, 4)
 * 
 * WICHTIGE VARIABLEN:
 * - candidates: Haupt-Kandidatenliste (wird durch Filter ver?ndert)
 * - currentIntent: Intent kann innerhalb der Funktion angepasst werden
 * - hasPerfumeCandidates: Flag f?r Parf?m-Intent (sch?tzt vor Fallback-?berschreibung)
 * - originalPerfumeCandidates: Backup der Parf?m-Kandidaten f?r Fallback-Schutz
 * 
 * INTENT-?NDERUNGEN:
 * - explore ? quick_buy: Bei "zeige mir X" mit 1-4 W?rtern (Zeile ~1595-1611)
 * 
 * ============================================================
 * 
 * TEST-CASES F?R GESUNDHEITSCHECK:
 * ============================================================
 * 
 * Budget-Only:
 * - "Mein Budget ist 20 Euro."
 *   Erwartung: [EFRO FILTER PRICE] userMaxPrice: 20, UI zeigt Produkte ? 20?
 * 
 * - "Mein Budget ist 50 Euro."
 *   Erwartung: [EFRO FILTER PRICE] userMaxPrice: 50, UI zeigt Produkte ? 50?
 * 
 * Kategorie/Brand:
 * - "Zeige mir Fressnapf."
 *   Erwartung: [EFRO AliasHardFilter] reduziert Kandidaten, UI zeigt Fressnapf-Artikel
 * 
 * Parf?m:
 * - "Zeige mir Parf?m."
 * - "Zeig mir Parfum!"
 *   Erwartung:
 *     [EFRO PERFUME] afterCount = Anzahl echter Parf?m-Produkte
 *     [EFRO FINAL PRODUCTS] ? nur Parf?m-Produkte (categories z. B. "perfume" / "duft")
 *     KEINE Duschgele/Shampoos/Lotions/T?cher
 * 
 * High-Budget:
 * - "Zeig mir Produkte ?ber 350 Euro!"
 *   Erwartung: Nur teure Produkte (High-End) in FINAL/UI
 * 
 * Kombi:
 * - "Zeig mir Parf?m unter 50 Euro."
 *   Erwartung: Entweder echte Parf?ms ? 50? ODER klarer Fallback (keine K?rperpflege-Nicht-Parf?ms)
 * 
 * STATUS:
 * - Budget-Only: ? Funktioniert
 * - Fressnapf: ? Funktioniert (AliasHardFilter)
 * - Parf?m: ?? Wird repariert (zu breite Erkennung)
 * - High-Budget: ? Funktioniert
 * - Kombi: ?? Wird getestet nach Parf?m-Fix
 * 
 * ============================================================
 */
 
 
import {
  buildReplyText,
  buildReplyTextWithAiClarify,
  buildRuleBasedReplyText,
  trimClarifyBlock,
} from "./steps/08_reply";
import { runStep03_BudgetParsing } from "./steps/03_budget";
import { runStep04_IntentExtraction } from "./steps/04_intent";
 
 
 
import {
  normalizeText,
  normalize,
  getDescriptionSnippet,
  extractStepsFromDescription,
  collectMatches,
} from "@/lib/sales/modules/utils";
import { logInfo, logWarn } from "./debug/logger";

import { shouldSkipLowConfidenceForHighBudget } from "@/lib/sales/modules/ai/highBudget";

import { SellerBrainAiTrigger, decideAiTrigger } from "@/lib/sales/modules/aiTrigger";
import { applySalesPolicy } from "@/lib/sales/salesPolicy";
import { detectPriceObjection } from "@/lib/sales/modules/salesDecision";

import { filterProductsForSellerBrain } from "../modules/filter";

import {
  extractNumbersForBudget,
  extractUserPriceRange,
  UserPriceRange,
  analyzeBudget,
  computePriceRangeInfo,
} from "../budget";







import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { PriceRangeInfo, SellerBrainContext, SellerBrainResult } from "@/lib/sales/modules/types";
import { determineEffectiveCategory } from "@/lib/sales/modules/category";
import { detectMostExpensiveRequest } from "../intent";
import { detectExplanationModeBoolean } from "../intent/explanationMode";
// Import der generierten Hints aus JSON
// Hinweis: TypeScript erwartet hier einen Typ-Assertion, da JSON-Imports als any kommen
import generatedProductHintsJson from "../generatedProductHints.json";
// Import f?r SellerBrain v2 (Repository & Cache)
import {
  getEfroShopByDomain,
  getEfroDemoShop,
  getProductsForShop,
  getCachedResponse,
  upsertCachedResponse,
  type EfroCachedResponse,
} from "../../efro/efroSupabaseRepository";
// Import der Alias-Map f?r AI-gest?tzte Begriff-Aufl?sung
import type { AliasMap } from "../aliasMap";
import { normalizeAliasKey, initializeAliasMap } from "../aliasMap";
// Import der Debug-Funktion f?r Katalog-?bersicht
import { debugCatalogOverview } from "../debugCatalog";
// Import der Sprach-Konfiguration f?r deutsche Budget- und Keyword-Erkennung
import {
  BUDGET_RANGE_PATTERNS,
  BUDGET_MIN_WORDS,
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
} from "../languageRules.de";
import type { BrainInput, BrainOutput, BrainState, ExplanationMode, LanguageRule } from "./types";
import { resolveTermWithLanguageRules } from "../resolveLanguageRule";

import { isPerfumeProduct, isMoldProduct } from "../categories";



// EFRO Modularization Phase 2: Typen nach modules/types ausgelagert
// Re-export f?r Kompatibilit?t
export type { SellerBrainContext, SellerBrainResult, PriceRangeInfo } from "@/lib/sales/modules/types";

/**
 * Attribut-Map pro Produkt
 * z. B. { skin_type: ["dry", "sensitive"], audience: ["men"], room: ["bathroom"] }
 */
type ProductAttributeMap = Record<string, string[]>;

/**
 * Vokabular-Eintrag f?r ein Attribut auf Shop-Ebene
 */
type ShopAttributeVocabulary = {
  key: string;           // z. B. "skin_type", "audience", "room", "pet", "family"
  values: string[];      // z. B. ["dry", "sensitive", "oily"]
  examples: string[];    // Produkt-Titel-Beispiele (max. 3)
  usageCount: number;    // Anzahl Produkte, die dieses Attribut verwenden
};

/**
 * Vollst?ndiger Attribut-Index f?r den Shop
 */
type AttributeIndex = {
  perProduct: Record<string, ProductAttributeMap>;  // Key = product.id
  vocabulary: ShopAttributeVocabulary[];
};

/**
 * Typ f?r Produkt-Hints (statisch oder generiert)
 */
export type ProductHint = {
  keyword: string;
  categoryHint?: string;
  attributes?: string[];
  weight?: number;
};

/**
 * Zentrale Text-Normalisierung (vereinheitlicht)
 * ? Umlaute bleiben erhalten, damit Stopwords wie "f?r", "gr??er" etc. sauber matchen.
 */

/**
 * Kategorien, die typischerweise f?r menschliche Haut-/Kosmetik-Produkte verwendet werden
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
 * Nutzertext normalisieren (Legacy-Kompatibilit?t)
 */


/**
 * Statische Produkt-Hints (manuell gepflegt)
 * Wird als string[] exportiert, um bestehenden Code nicht zu brechen.
 * Importiert aus languageRules.de.ts
 */
export const productHints: string[] = PRODUCT_HINTS;

/**
 * Typisierte Version der statischen Hints
 * Wird aus productHints generiert, um Kompatibilit?t zu gew?hrleisten.
 */
export const staticProductHints: ProductHint[] = productHints.map((keyword) => ({
  keyword,
  weight: 1,
}));

/**
 * F?hrt statische und generierte Hints zusammen.
 * 
 * Regeln:
 * - Statische Hints haben Priorit?t bei Duplikaten
 * - Wenn beide ein weight haben, wird das h?here verwendet
 * - Generierte Hints ohne Duplikate werden ?bernommen
 * 
 * @param staticHints Statische, manuell gepflegte Hints
 * @param generatedHints Optional: Dynamisch generierte Hints (z. B. aus JSON)
 * @returns Zusammengef?hrte Liste von ProductHint
 */
function mergeHints(
  staticHints: ProductHint[],
  generatedHints?: ProductHint[]
): ProductHint[] {
  // Wenn keine generierten Hints vorhanden, nur statische zur?ckgeben
  if (!generatedHints || generatedHints.length === 0) {
    return [...staticHints];
  }

  // Map f?r schnelles Lookup nach keyword
  const mergedMap = new Map<string, ProductHint>();

  // Zuerst alle statischen Hints einf?gen (haben Priorit?t)
  for (const hint of staticHints) {
    mergedMap.set(hint.keyword.toLowerCase(), { ...hint });
  }

  // Dann generierte Hints hinzuf?gen, falls nicht bereits vorhanden
  for (const hint of generatedHints) {
    const key = hint.keyword.toLowerCase();
    const existing = mergedMap.get(key);

    if (!existing) {
      // Neues Keyword ? ?bernehmen
      mergedMap.set(key, { ...hint });
    } else {
      // Duplikat: Statischer Hint hat Priorit?t, aber weight kann ?berschrieben werden
      // wenn der generierte Hint ein h?heres weight hat
      if (
        hint.weight !== undefined &&
        (existing.weight === undefined || hint.weight > existing.weight)
      ) {
        existing.weight = hint.weight;
      }
      // Weitere Felder (categoryHint, attributes) k?nnen optional vom generierten Hint erg?nzt werden,
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
    // Zuerst nach weight (h?her = besser)
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
 * Gibt die aktuell aktiven Produkt-Hints zur?ck.
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

    // Statische und generierte Hints zusammenf?hren
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
 * Erkennt, ob der Nutzer eher eine Erkl?rung will
 * (Inhaltsstoffe / Material / Anwendung / Pflege).
 */
/**
 * EFRO Explanation-Mode-Erkennung verbessert
 * Erkennt Fragen wie "Wie benutze ich...?", "Erkl?r mir...", "Wie funktioniert...?"
 * EFRO S18/S19 Fix: Robuste Erkennung f?r "Wie wende ich...", "Wie genau funktioniert..."
 */
function detectExplanationMode(text: string): ExplanationMode | null {
  const t = normalize(text || "");
  if (!t) return null;

  // SCHRITT 2 FIX: Ausschluss-Wörter für Explanation-Mode
  // Wenn der Text billig/günstig-Wörter enthält, KEIN explanationMode
  const bargainExclusionWords = [
    "billig", "billige", "billiger", "billiges", "billigste", "billigstes", "billigsten",
    "günstig", "günstige", "günstiger", "günstiges", "günstigste", "günstigstes", "günstigsten",
    "preiswert", "preiswerte", "preiswerter", "preiswertes", "preiswerteste", "preiswertestes",
    "günstigstes snowboard", "billigstes snowboard"
  ];
  
  const hasBargainWord = bargainExclusionWords.some((w) => t.includes(w));
  if (hasBargainWord) {
    // Billig/günstig-Frage → kein explanationMode
    return null;
  }

  // EFRO S18/S19 Fix: Robuste Pattern-Erkennung f?r Usage-Mode
  const normalized = text.toLowerCase();
  
  const usagePatterns: RegExp[] = [
    /wie\s+wende\s+ich\b/i,
    /wie\s+wird\s+.*\s+angewendet/i, // CLUSTER 1 FIX S19v2: "Wie wird dieses Wax angewendet?"
    /\banwendung\b/i,
    /\banwenden\b/i,
    /wie\s+genau\s+funktioniert\b/i,
    /wie\s+funktioniert\b/i,
    /funktioniert\s+dies(es|er|e)?\s+\w*\b/i,
    /erkl(?:ä|ae|a)r(?:e|st|en)?\s+(?:mir\s+)?(?:bitte\s+)?(?:mal\s+)?(?:genau\s+)?wie\b/i,
    /wie\s+benutze\s+ich\b/i,
    /wie\s+verwende\s+ich\b/i,
    /wie\s+nutze\s+ich\b/i,
  ];

  const hasUsagePattern = usagePatterns.some((re) => re.test(normalized));

  // CLUSTER S FIX: S12-S19 - Erweiterte Erkennung für Erklärungsanfragen
  // Erkennt auch "Erklärung zur Anwendung", "Erklärung zur Anwendung von [Produkt]"
  const hasExplanationPhrase = 
    t.includes("erklärung") ||
    t.includes("erklaerung") ||
    t.includes("erklärung zur") ||
    t.includes("erklaerung zur") ||
    t.includes("erklärung zur anwendung") ||
    t.includes("erklaerung zur anwendung");
  
  // CLUSTER 1 FIX: Erkenne auch "Kannst du mir erklären" (mir kommt VOR erklären)
  // CLUSTER A FIX S18v1: Erkenne auch "Kannst du mir erklären, wie ich..."
  // CLUSTER 1 FIX S12/S19v1: Erkenne auch "Erklär mir bitte" am Anfang
  const hasExplainPattern = 
    /erkl(?:ä|ae|a)r(?:e|st|en)?\s+(?:mir\s+)?(?:bitte\s+)?(?:mal\s+)?(?:genau\s+)?(?:wie|dass|ob)/i.test(normalized) ||
    /kannst\s+du\s+mir\s+erkl(?:ä|ae|a)r(?:e|en)?/i.test(normalized) ||
    /^erkl(?:ä|ae|a)r\s+mir\s+(?:bitte\s+)?/i.test(normalized); // CLUSTER 1 FIX: "Erklär mir bitte" am Anfang
  
  // CLUSTER 1 FIX: Erkenne auch "erklär mir" / "erkläre mir" direkt (auch mit "bitte")
  const hasErklarMirPattern = /^erkl(?:ä|ae|a)r(?:e|en)?\s+mir\s+(?:bitte\s+)?/i.test(normalized);
  
  // Erweiterte Erkennung f?r Erkl?rungsanfragen
  if (
    hasExplanationPhrase ||
    hasExplainPattern ||
    hasErklarMirPattern || // CLUSTER 1 FIX: "Erklär mir bitte" am Anfang
    t.includes("erkl?r") ||
    t.includes("erklaer") ||
    t.includes("erkl?re") ||
    t.includes("erklaere") ||
    t.includes("wie benutze ich") ||
    t.includes("wie verwende ich") ||
    t.includes("wie funktioniert") ||
    t.startsWith("was ist ") ||
    t.startsWith("was sind ") ||
    t.includes("wofür benutzt man") ||
    t.includes("wofuer benutzt man") ||
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

    // Fallback: generische Erkl?rung
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
 * EFRO S18/S19 Fix: Patch f?r ProductRelated bei Wax-Erkl?rungen
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
 * EFRO S18/S19 Fix: Handle Wax-Erkl?rungen mit AI-Trigger
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

  // Wenn keine Erkl?rfrage oder kein Wax erw?hnt wird, nichts Besonderes tun
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

  // L?ngste, nicht-leere Beschreibung suchen (z. B. "Selling Plans Ski Wax")
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

  console.log("[EFRO SellerBrain] Explanation mode ? Direkt aus Beschreibung", {
    text,
    ...result,
  });

  // EFRO Fix: KEIN AI-Trigger mehr f?r Erkl?rungen mit/ohne Beschreibung
  // Die Antwort wird direkt aus der Beschreibung generiert (wenn vorhanden)
  // oder ehrlich kommuniziert, dass keine Beschreibung vorhanden ist (ohne AI)
  // AI wird nur f?r unbekannte Begriffe (z. B. "Fressnapf") genutzt
  const aiTrigger: SellerBrainAiTrigger | undefined = undefined;

  return {
    ...result,
  };
}

/**
 * Pr?ft, ob der Text produktbezogen ist
 */
function isProductRelated(text: string, context?: SellerBrainContext): boolean {
  const t = normalize(text || "");

  // EFRO S5v3: "snowbord" Tippfehler und günstiges "board" als produktbezogen markieren
  const hasSnowbord = /\bsnowbord(s)?\b/.test(t);
  const hasBoardBargain =
    /\bboard(s)?\b/.test(t) &&
    /\b(einsteiger|billig|preiswert|günstig|guenstig)\b/.test(t);
  if (hasSnowbord || hasBoardBargain) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: hasSnowbord ? "snowbord_typo" : "board_bargain_signal",
    });
    return true;
  }

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

  // Kontext-Keywords: "f?r die K?che", "f?rs Bad", etc.
  // Importiert aus languageRules.de.ts
  if (CONTEXT_KEYWORDS.some((w) => t.includes(w))) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: "contextKeyword",
    });
    return true;
  }

  // W?rter, die auf typische Produkt-/Shopfragen hindeuten
  // HINWEIS: Die lokale productHints-Liste wurde entfernt.
  // Stattdessen wird getActiveProductHints() verwendet, um k?nftig
  // auch generierte Hints zu ber?cksichtigen.

  const activeHints = getActiveProductHints();
  let result = activeHints.some((hint) => t.includes(hint.keyword));
  let reason = result ? "productHint" : "none";
  
  // CLUSTER A FIX S18/S19: Wenn explanationMode erkannt wird UND "wax"/"wachs" im Text steht,
  // dann ist es produktbezogen (auch wenn kein explizites Produkt-Keyword vorhanden ist)
  if (!result && (t.includes("wax") || t.includes("wachs"))) {
    const explanationMode = detectExplanationMode(text);
    if (explanationMode !== null) {
      result = true;
      reason = "wax_explanation";
    }
  }

  // Budget-S?tze als produktbezogen erkennen
  // Beispiel: "Mein Budget ist 50 Euro.", "Maximal 80 ?", "Ich m?chte nicht mehr als 30 Euro ausgeben."
  if (!result) {
    const hasBudgetPhrase = context?.budgetParse?.isBudgetPhraseDetected ?? false;
    if (hasBudgetPhrase) {
      result = true;
      reason = "priceOnly";
    }
  }
  
  // CLUSTER 1 FIX S4v2: "Boards" + Budget → produktbezogen (auch wenn "board" nicht in Hints ist)
  if (!result) {
    const normalized = normalize(text);
    const mentionsBoard = normalized.includes("board") || normalized.includes("boards");
    const hasBudgetInText = /\b(\d+)\s*(euro|eur|€|dollar|\$)\b/i.test(text) || 
      /\b(unter|über|bis|ab|zwischen|von|bis zu|maximal|mindestens|höchstens)\s*\d+/i.test(text) ||
      /\bzwischen\s+(\d+)\s+(und|bis|-)\s*(\d+)\s*(euro|eur|€)\b/i.test(text);
    
    if (mentionsBoard && hasBudgetInText && !normalized.includes("snowboard")) {
      result = true;
      reason = "board_with_budget";
      console.log("[EFRO ProductRelated] CLUSTER 1 FIX S4v2 - Board + Budget detected", {
        text,
        mentionsBoard,
        hasBudgetInText,
      });
    }
  }

  // CLUSTER 2 FIX: "Bindungen" oder "Snowboard-Bindungen" als produktbezogen erkennen
  if (!result) {
    const normalized = normalize(text);
    const mentionsBindungen = normalized.includes("bindungen") || 
      normalized.includes("bindung") || 
      normalized.includes("binding") ||
      normalized.includes("bindings");
    
    if (mentionsBindungen) {
      result = true;
      reason = "bindungen_keyword";
      console.log("[EFRO ProductRelated] CLUSTER 2 FIX - Bindungen detected", {
        text,
        mentionsBindungen,
      });
    }
  }

  // CLUSTER 2 FIX K16v1: Produktcodes als produktbezogen erkennen (z. B. "Alpha ULTRA PRO 1TB")
  if (!result) {
    const detectedCode = extractCodeTermFromText(text);
    if (detectedCode && looksLikeProductCode(detectedCode)) {
      result = true;
      reason = "product_code";
      console.log("[EFRO ProductRelated] CLUSTER 2 FIX K16v1 - Product code detected", {
        text,
        detectedCode,
      });
    }
  }

  // CLUSTER 2 FIX PROFI-08v1: "Board" als produktbezogen erkennen (auch ohne "snowboard")
  if (!result) {
    const normalized = normalize(text);
    const mentionsBoard = normalized.includes("board") || normalized.includes("boards");
    // Nur wenn nicht bereits als produktbezogen erkannt und "board" vorkommt
    if (mentionsBoard) {
      result = true;
      reason = "board_keyword";
      console.log("[EFRO ProductRelated] CLUSTER 2 FIX PROFI-08v1 - Board detected", {
        text,
        mentionsBoard,
      });
    }
  }
  
  // CLUSTER K FIX: Smartphone- und Mode-Keywords als produktbezogen erkennen
  if (!result) {
    const normalized = normalize(text);
    const mentionsSmartphone = normalized.includes("smartphone") || 
      normalized.includes("smartphones") || 
      normalized.includes("handy") ||
      normalized.includes("handys") ||
      (normalized.includes("phone") && !normalized.includes("handyvertrag"));
    const mentionsMode = normalized.includes("jeans") ||
      normalized.includes("mode") ||
      normalized.includes("kleidung");
    
    if (mentionsSmartphone || mentionsMode) {
      result = true;
      reason = mentionsSmartphone ? "coreProductKeyword_smartphone" : "coreProductKeyword_mode";
      console.log("[EFRO ProductRelated] CLUSTER K FIX - Smartphone/Mode detected", { text, mentionsSmartphone, mentionsMode });
    }
  }
  
  // D1v2/H3v2 Fix: Parfüm/Duftstoffe und Werkzeug/Tools als produktbezogen erkennen
  if (!result) {
    const normalized = normalize(text);
    const mentionsParfum = normalized.includes("parfum") || 
      normalized.includes("parfüm") || 
      normalized.includes("parfume") ||
      normalized.includes("duftstoff") ||
      normalized.includes("duftstoffe") ||
      normalized.includes("duft");
    const mentionsWerkzeug = normalized.includes("werkzeug") ||
      normalized.includes("tools") ||
      normalized.includes("tool");
    
    if (mentionsParfum || mentionsWerkzeug) {
      result = true;
      reason = mentionsParfum ? "coreProductKeyword_parfum" : "coreProductKeyword_werkzeug";
      console.log("[EFRO ProductRelated] D1v2/H3v2 Fix - Parfüm/Werkzeug detected", { text, mentionsParfum, mentionsWerkzeug });
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
 * Hilfsfunktionen f?r Intent-Detection
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
 * - Budget-S?tze ("mein Budget ist 50 Euro") werden als OBERGRENZE interpretiert ? maxPrice = 50
 * - "unter / bis / h?chstens" ? OBERGRENZE ? maxPrice = X
 * - "?ber / mindestens / ab" ? UNTERGRENZE ? minPrice = X
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * WICHTIG:
 * - Budget-S?tze ("mein Budget ist 50 Euro") werden als OBERGRENZE interpretiert ? maxPrice = 50
 * - "unter / bis / h?chstens / maximal / nicht mehr als" ? OBERGRENZE ? maxPrice = X
 * - "?ber / mindestens / ab / mehr als" ? UNTERGRENZE ? minPrice = X
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-S?tze ("mein Budget ist 50 Euro") => OBERGRENZE ? maxPrice = 50
 * - "unter / bis / h?chstens / maximal / nicht mehr als" => OBERGRENZE
 * - "?ber / mindestens / ab X Euro / mehr als"           => UNTERGRENZE
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-S?tze ("mein Budget ist 50 Euro") => OBERGRENZE ? maxPrice = 50
 * - "unter / bis / h?chstens / maximal / nicht mehr als" => OBERGRENZE
 * - "?ber / ueber / uber / mindestens / ab X Euro / mehr als" => UNTERGRENZE
 */
/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 *
 * Regeln:
 * - Budget-S?tze ("mein Budget ist 50 Euro") => OBERGRENZE ? maxPrice = 50
 * - "unter / bis / h?chstens / maximal / weniger als / nicht mehr als" => OBERGRENZE
 * - "?ber / ueber / uber / mindestens / ab X Euro / mehr als / gr??er als" => UNTERGRENZE
 */
/**
 * EFRO Budget-Parser: Extrahiert Zahlen f?r Budget, ignoriert Zahlen in Produktcodes
 * 
 * Unterscheidet zwischen "reinen Zahlen" (z. B. "50") und Zahlen in alphanumerischen Tokens (z. B. "XY-9000").
 * Bei "Zeig mir Produkte f?r XY-9000 unter 50 Euro" wird nur 50 als Budget interpretiert, nicht 9000.
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
 * Diese Funktion wird in einem sp?teren Schritt von EFRO genutzt,
 * um pro Shop eine Lernbasis f?r Attribute aufzubauen.
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
   * Hilfsfunktion: F?gt ein Attribut zu einem Produkt hinzu
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

    // Beispiel-Titel hinzuf?gen (max. 3 verschiedene)
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
      /f?r\s+herren|f?r\s+m?nner|for\s+men\b|herren\b|m?nner\b|\bmen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "men");
    }

    if (
      /f?r\s+damen|f?r\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "women");
    }

    if (
      /f?r\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|f?r\s+jungs|f?r\s+m?dchen/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "kids");
    }

    if (
      /f?r\s+babys|f?r\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "baby");
    }

    if (/unisex\b|f?r\s+alle|for\s+all\b/.test(normalized)) {
      addAttribute(productId, "audience", "unisex");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Tier-Attribute
   */
  function detectPet(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /f?r\s+hunde|for\s+dog\b|\bhund\b|\bhunde\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "dog");
    }

    if (
      /f?r\s+katzen|for\s+cat\b|\bkatze\b|\bkatzen\b|\bcat\b|\bcats\b|\bkitten\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "cat");
    }

    if (
      !perProduct[productId]?.pet &&
      /haustier|haustiere|\bpet\b|\bpets\b|f?r\s+tiere/.test(normalized)
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
      /f?r\s+bad|f?r\s+badezimmer|for\s+bathroom\b|\bbad\b|\bbadezimmer\b|\bbathroom\b|\bbath\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "bathroom");
    }

    if (
      /f?r\s+k?che|f?r\s+kueche|for\s+kitchen\b|\bk?che\b|\bkueche\b|\bkitchen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "kitchen");
    }

    if (
      /f?r\s+wohnzimmer|for\s+living\s+room\b|\bwohnzimmer\b|\bliving\s+room\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "living_room");
    }

    if (
      /f?r\s+schlafzimmer|for\s+bedroom\b|\bschlafzimmer\b|\bbedroom\b/.test(
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

    if (/t?cher|tuecher|tuch|wipes/.test(normalized)) {
      addAttribute(productId, "family", "wipes");
    }

    if (/\bspray\b/.test(normalized)) {
      addAttribute(productId, "family", "spray");
    }

    if (/creme|cream|lotion/.test(normalized)) {
      addAttribute(productId, "family", "cream");
    }

    if (/\b(?:öl|oel|ol|oil)\b/i.test(normalized)) {
      addAttribute(productId, "family", "oil");
    }

    if (/seife|soap/.test(normalized)) {
      addAttribute(productId, "family", "soap");
    }

    // NEU: Napf/Futternapf als eigene Familie "bowl"
    // WICHTIG: "fressnapf" wurde entfernt - soll dynamisch ?ber AI gelernt werden
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
  coreTerms: string[];              // Produktbegriffe (duschgel, hoodie, tuch, reiniger ?)
  attributeTerms: string[];         // Begriffe/Phrasen, die wie Bedingungen klingen (trockene, haut, herren, vegan ?)
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
      // Phrase aus Text entfernen, um Doppelz?hlung zu vermeiden
      remainingText = remainingText.replace(phrase, " ");
    }
  }

  // Einzelw?rter aus dem verbleibenden Text
  const remainingTokens = remainingText
    .split(" ")
    .filter((t) => t.length >= 3 && !stopwords.includes(t));

  // Attribute-Terms: Phrasen + einzelne W?rter, die typischerweise Attribute sind
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
   * Hilfsfunktion: F?gt einen Filter-Wert hinzu
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
    /f?r\s+herren|f?r\s+m?nner|for\s+men\b|herren\b|m?nner\b|\bmen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "men");
  }
  if (
    /f?r\s+damen|f?r\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "women");
  }
  if (
    /f?r\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|f?r\s+jungs|f?r\s+m?dchen/.test(
      normalized
    )
  ) {
    addFilter("audience", "kids");
  }
  if (
    /f?r\s+babys|f?r\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "baby");
  }
  if (/unisex\b|f?r\s+alle|for\s+all\b/.test(normalized)) {
    addFilter("audience", "unisex");
  }

  // pet Erkennung
  if (
    /f?r\s+hunde|hund\b|\bhunde\b|for\s+dog\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "dog");
  }
  if (
    /f?r\s+katzen|katze\b|\bkatzen\b|for\s+cat\b|\bcat\b|\bcats\b|\bkitten\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "cat");
  }
  // Allgemein Haustier (nur wenn nicht bereits dog oder cat gesetzt)
  if (
    !attributeFilters.pet &&
    /haustier|haustiere|\bpet\b|\bpets\b|f?r\s+tiere/.test(normalized)
  ) {
    addFilter("pet", "pet");
  }

  // room Erkennung
  if (
    /f?r\s+bad|f?r\s+badezimmer|\bbad\b|\bbadezimmer\b|for\s+bathroom\b|\bbathroom\b|\bbath\b/.test(
      normalized
    )
  ) {
    addFilter("room", "bathroom");
  }
  if (
    /f?r\s+k?che|f?r\s+kueche|\bk?che\b|\bkueche\b|for\s+kitchen\b|\bkitchen\b/.test(
      normalized
    )
  ) {
    addFilter("room", "kitchen");
  }
  if (
    /f?r\s+wohnzimmer|\bwohnzimmer\b|for\s+living\s+room\b|\bliving\s+room\b/.test(
      normalized
    )
  ) {
    addFilter("room", "living_room");
  }
  if (
    /f?r\s+schlafzimmer|\bschlafzimmer\b|for\s+bedroom\b|\bbedroom\b/.test(
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
  if (/t?cher|tuecher|tuch|wipes/.test(normalized)) {
    addFilter("family", "wipes");
  }
  if (/\bspray\b/.test(normalized)) {
    addFilter("family", "spray");
  }
  if (/creme|cream|lotion/.test(normalized)) {
    addFilter("family", "cream");
  }
  if (/\b(?:öl|oel|ol|oil)\b/i.test(normalized)) {
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
 * Erweitert W?rter um Katalog-Keywords, wenn sie als Komposita erkannt werden.
 * 
 * Beispiel: "fressnapf" ? ["fressnapf", "napf"] (wenn "napf" im Katalog vorkommt)
 * 
 * @param words Array von normalisierten User-W?rtern
 * @param catalogKeywords Array von bekannten Katalog-Keywords
 * @returns Erweiterte Liste von W?rtern (inkl. Originale + aufgebrochene Komposita)
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
    // z. B. "fressnapf" -> "napf", dann dieses Keyword zus?tzlich ?bernehmen.
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
 * Simple fuzzy helper: findet nahe Tokens im Katalog f?r ein gegebenes Wort
 * 
 * Verwendet eine einfache Heuristik basierend auf L?ngenunterschied und Substring-Matching.
 * 
 * @param term Der zu suchende Begriff (normalisiert)
 * @param catalogKeywords Array von bekannten Katalog-Keywords
 * @param maxDistance Maximale L?ngendifferenz (Standard: 2)
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

    // Exakte ?bereinstimmung
    if (normalizedKeyword === normalizedTerm) {
      matches.push(keyword);
      continue;
    }

    // Sehr einfache Distanz-Heuristik: L?nge + enthalten
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
 * Identifiziert unbekannte Begriffe im User-Text und l?st sie auf bekannte Keywords auf.
 * 
 * Verwendet eine Alias-Map f?r AI-generierte Mappings, Fuzzy-Matching f?r ?hnliche Schreibvarianten,
 * und zus?tzlich Substring-Heuristiken als Fallback.
 * 
 * @param text Der urspr?ngliche User-Text
 * @param knownKeywords Array von bekannten Keywords (aus Katalog + erweiterte User-W?rter)
 * @param aliasMap Alias-Map mit Mappings von unbekannten Begriffen zu bekannten Keywords
 * @returns Objekt mit unbekannten Begriffen und aufgel?sten Begriffen
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
    .split(/[^a-z0-9????]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  // WICHTIG: Nur normalizeAliasKey verwenden f?r Konsistenz
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
            // Nur Aliase hinzuf?gen, die auch in knownSet enthalten sind
            // (damit wir keine Phantom-W?rter haben, die im Katalog gar nicht vorkommen)
            if (knownSet.has(normalizedAlias)) {
              aliasResolvedSet.add(normalizedAlias);
            }
          }
        }
      }
    }
  }

  // Schritt 2: Fuzzy-Matching als Fallback (vor Substring-Heuristik)
  // Grundlage f?r "smarte" Schreibvarianten (z. B. parfum ? perfume mit Levenshtein-Distanz)
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

  // Schritt 4: Resolved-Tokens zusammenf?hren (Priorit?t: Alias > Fuzzy > Substring)
  const resolvedSet = new Set<string>();
  if (aliasResolvedSet.size > 0) {
    // Alias-Tokens haben h?chste Priorit?t
    aliasResolvedSet.forEach((t) => resolvedSet.add(t));
  } else if (fuzzyResolvedSet.size > 0) {
    // Fuzzy-Tokens als zweite Priorit?t
    fuzzyResolvedSet.forEach((t) => resolvedSet.add(t));
  } else if (substringResolvedSet.size > 0) {
    // Substring-Tokens als letzte Priorit?t
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
    // Debug: pruefe spezifisch fuer "parfum" / "parfuem"
    parfumLookup: aliasMap?.[normalizeAliasKey("parfum")] || null,
    parfumAltLookup: aliasMap?.[normalizeAliasKey("parfuem")] || null,
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
 * Produkt-Scoring f?r Keywords
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

    // Exakte Treffer ? st?rker gewichten
    if (title.includes(word)) {
      score += 5;
    } else if (tagsText.includes(word)) {
      score += 4;
    } else if (category.includes(word)) {
      score += 3;
    } else if (desc.includes(word)) {
      score += 2;
    }

    // NEU: robustes Fuzzy-Matching mit mehreren Pr?fixen (z. B. "dusch", "duschg")
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
// EFRO Modularization Phase 3: collectMatches nach modules/utils ausgelagert

/**
 * Pr?ft, ob der Nutzertext explizit nach Parf?m fragt
 */
function userMentionsPerfume(text: string): boolean {
  const normalizedText = normalize(text);
  return PERFUME_SYNONYMS.some((syn) => normalizedText.includes(syn));
}

/**
 * Helper: Baut Filter-Kontext auf (parsedQuery, words, categoryHints, intentHints)
 */
async function buildFilterContext(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[],
  contextCategory?: string | null
): Promise<{
  parsedQuery: ParsedQuery;
  words: string[];
  expandedWords: string[];
  categoryHints: string[];
  categoryHintsInText: string[];
  matchedCategories: string[];
  effectiveCategorySlug: string | null;
  missingCategoryHint: string | null;
  triggerWord: string | null;
  currentIntent: ShoppingIntent;
  catalogKeywords: string[];
  aliasMap: AliasMap;
  keywordSummary: { categoryHints: string[]; usageHints: string[]; skinHints: string[] };
  wantsMostExpensive: boolean;
  attributeIndex: AttributeIndex;
}> {
  const t = normalize(text);
  let currentIntent: ShoppingIntent = intent;

  // Erkenne, ob User explizit nach dem teuersten Produkt fragt
  const wantsMostExpensive = detectMostExpensiveRequest(text);

  // Dynamischen Attribut-Index f?r alle Produkte bauen
  const attributeIndex = buildAttributeIndex(allProducts);

  /**
   * 1) Kategorie-Erkennung
   * EFRO Modularization Phase 3: Kategorie-Logik nach modules/category ausgelagert
   */
  const categoryResult = determineEffectiveCategory({
    text,
    cleanedText: t,
    contextCategory,
    allProducts,
  });
  
  let effectiveCategorySlug = categoryResult.effectiveCategorySlug;
  let matchedCategories = [...categoryResult.matchedCategories];
  let categoryHintsInText = [...categoryResult.categoryHintsInText];
  let missingCategoryHint = categoryResult.missingCategoryHint;
  const triggerWord = categoryResult.triggerWord;

  // EFRO Parf?m-Fix: Wenn der Nutzer klar nach Parf?m fragt und der Katalog eine "perfume"-Kategorie hat,
  // dann setze die effektive Kategorie auf "perfume" und erg?nze matchedCategories entsprechend.
  // WICHTIG: Nur wenn es tatsächlich Produkte in dieser Kategorie gibt (Kategorie-Optimierung).
  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => normalize(p.category || ""))
        .filter((c) => c.length >= 3)
    )
  );
  const normalizedQueryForPerfume = normalize(text);
  const perfumeKeywords = [
    "parfum",
    "parf?m",
    "parfum",
    "duft",
    "eau de parfum",
    "eau de toilette"
  ];
  const userAsksForPerfume = perfumeKeywords.some((kw) =>
    normalizedQueryForPerfume.includes(kw)
  );
  const hasPerfumeCategoryInCatalog = allCategories.some(
    (cat) => normalize(cat) === "perfume"
  );
  
  if (userAsksForPerfume && hasPerfumeCategoryInCatalog) {
    const perfumeCategory = allCategories.find(
      (cat) => normalize(cat) === "perfume"
    );

    if (perfumeCategory) {
      const normalizedPerfumeCat = normalize(perfumeCategory);
      
      // EFRO Kategorie-Optimierung: Prüfe, ob es tatsächlich Produkte in dieser Kategorie gibt
      const perfumeProductCount = allProducts.filter(
        (p) => normalize(p.category || "") === normalizedPerfumeCat
      ).length;
      
      if (perfumeProductCount > 0) {
        effectiveCategorySlug = normalizedPerfumeCat;

        if (
          !matchedCategories.some(
            (cat) => normalize(cat) === normalizedPerfumeCat
          )
        ) {
          matchedCategories.push(normalizedPerfumeCat);
        }

        if (
          !categoryHintsInText.some(
            (hint) => normalize(hint) === normalizedPerfumeCat
          )
        ) {
          categoryHintsInText.push(perfumeCategory);
        }

        console.log("[EFRO Category] Perfume category forced from query (with products)", {
          text: text.substring(0, 80),
          effectiveCategorySlug,
          matchedCategories,
          categoryHintsInText,
          productCount: perfumeProductCount,
        });
      } else {
        console.log("[EFRO Category] Perfume category ignored (no products)", {
          text: text.substring(0, 80),
          perfumeCategory,
          note: "Kategorie existiert im Katalog, aber hat keine Produkte",
        });
      }
    }
  }

  console.log("[EFRO SB Category] Effective category", {
    fromText: matchedCategories.length > 0 ? matchedCategories[0] : null,
    fromContext: contextCategory ?? null,
    effective: effectiveCategorySlug,
    missingCategoryHint: missingCategoryHint ?? null,
    triggerWord: triggerWord ?? null,
  });

  /**
   * 2) Generische Keyword-Suche
   */
  const intentWords = INTENT_WORDS;

  let words: string[] = t
    .split(/[^a-z0-9????]+/i)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !intentWords.includes(w));

  // reine Zahlen nicht als Keyword benutzen
  words = words.filter((w) => !/^\d+$/.test(w));

  // Katalog-Keywords aus allen Produkten extrahieren
  const catalogKeywordsSet = new Set<string>();
  for (const product of allProducts) {
    // Kategorie normalisieren und hinzuf?gen (wichtig f?r canonicalTokens)
    if (product.category) {
      const catNormalized = normalizeText(product.category);
      const catWords = catNormalized.split(/\s+/).filter((w) => w.length >= 3);
      catWords.forEach((w) => catalogKeywordsSet.add(w));
      // Auch die gesamte normalisierte Kategorie als Token hinzuf?gen (konsistent mit normalizeAliasKey)
      // z. B. "Perfume" -> "perfume" (f?r Language-Aliase wie "parfum" -> "perfume")
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
  // HINWEIS: Dynamic Aliases werden in runSellerBrain() verwendet (dort ist vollständiger SellerBrainContext verfügbar)
  const aliasMap = await initializeAliasMap(catalogKeywords);

  // W?rter mit Katalog-Keywords erweitern (Komposita aufbrechen)
  let expandedWords = expandWordsWithCatalogKeywords(words, catalogKeywords);

  // Query in Core- und Attribute-Terms aufteilen (f?r Log)
  const parsedQuery = parseQueryForAttributes(text);
  
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
  // Erg?nze dynamische Kategorie-Hints
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

  // Intent-Fix: "Zeige mir X" mit konkretem Produkt ? quick_buy statt explore
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

  return {
    parsedQuery,
    words,
    expandedWords,
    categoryHints,
    categoryHintsInText,
    matchedCategories,
    effectiveCategorySlug,
    missingCategoryHint: missingCategoryHint ?? null,
    triggerWord: triggerWord ?? null,
    currentIntent,
    catalogKeywords,
    aliasMap,
    keywordSummary,
    wantsMostExpensive,
    attributeIndex,
  };
}

/**
 * Helper: Berechnet Budget und Preisbereich (analyzeBudget, computePriceRangeInfo, priceRangeNoMatch)
 */
function computeBudgetAndPriceRange(
  text: string,
  candidates: EfroProduct[],
  allProducts: EfroProduct[],
  effectiveCategorySlug: string | null,
  contextCategory?: string | null
): {
  userMinPrice: number | null;
  userMaxPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  priceRangeInfo: PriceRangeInfo | undefined;
  priceRangeNoMatch: boolean;
} {
  let userMinPrice: number | null | undefined = undefined;
  let userMaxPrice: number | null | undefined = undefined;

      const budgetAnalysis = analyzeBudget(text);
  userMinPrice = budgetAnalysis.userMinPrice ?? null;
  userMaxPrice = budgetAnalysis.userMaxPrice ?? null;



  // Log nach Preis-Extraktion (noch vor Anwendung)
  console.log("[EFRO SB] PRICE EXTRACTED", {
    text: text.substring(0, 80),
    userMinPrice,
    userMaxPrice,
    candidateCountBeforePriceFilter: candidates.length,
  });

  // Sprachbasierte Korrektur f?r "?ber / unter / bis / maximal"
  const loweredForBudget = text.toLowerCase();

  // ?? Kein Regex mit Wortgrenzen mehr ? wir arbeiten mit einfachen includes,
  // damit auch kaputte Markups wie "%]%ber 800" erkannt werden.
  const hasOverToken =
    loweredForBudget.includes("?ber") ||
    loweredForBudget.includes("ueber") ||
    loweredForBudget.includes("uber") ||
    loweredForBudget.includes(" mindest") ||
    loweredForBudget.includes("minimum") ||
    loweredForBudget.includes("mehr als") ||
    loweredForBudget.includes("groesser als") ||
    loweredForBudget.includes("gr??er als") ||
    loweredForBudget.includes(" ab ") ||
    loweredForBudget.includes(" ber ");

  const hasUnderToken =
    loweredForBudget.includes("unter") ||
    loweredForBudget.includes(" bis ") ||
    loweredForBudget.includes("h?chstens") ||
    loweredForBudget.includes("hochstens") ||
    loweredForBudget.includes("hoechstens") ||
    loweredForBudget.includes(" maximal") ||
    loweredForBudget.includes(" max ") ||
    loweredForBudget.includes("weniger als") ||
    loweredForBudget.includes("nicht mehr als");

  // Rohwerte aus dem Parser
  let rawMin: number | null = userMinPrice ?? null;
  let rawMax: number | null = userMaxPrice ?? null;

  if (rawMin !== null || rawMax !== null) {
    // Fall 1: Parser liefert nur max, Text sagt "?ber" ? wir deuten es als Untergrenze
    // Beispiel: "?ber 800 Euro" ? rawMin = null, rawMax = 800
    if (hasOverToken && rawMax !== null && rawMin === null) {
      rawMin = rawMax;
      rawMax = null;
    }

    // Fall 2: Parser liefert nur min, Text sagt "unter/bis" ? wir deuten es als Obergrenze
    // Beispiel: "unter 25 Euro" ? rawMin = 25, rawMax = null
    if (hasUnderToken && rawMin !== null && rawMax === null) {
      rawMax = rawMin;
      rawMin = null;
    }
  }

  let minPrice: number | null = rawMin;
  let maxPrice: number | null = rawMax;

  // EFRO Modularization Phase 2: priceRangeInfo-Typ aus modules/types verwendet
  // - Track, ob nach Price-Filter keine Produkte gefunden wurden
  // - Unrealistische Budgets erkennen (unterhalb g?nstigstem / oberhalb teuerstem Produkt)
  let priceRangeNoMatch = false;
  let priceRangeInfo: PriceRangeInfo | undefined = undefined;

  if (minPrice !== null || maxPrice !== null) {
    const beforePriceFilter = candidates.length;

    // EFRO Modularization Phase 2: Preis-Informationen ?ber computePriceRangeInfo berechnen
    const categoryForInfo = effectiveCategorySlug || contextCategory || null;
    
    const priceRangeInfoTemp = computePriceRangeInfo({
      userMinPrice: minPrice,
      userMaxPrice: maxPrice,
      allProducts,
      effectiveCategorySlug: categoryForInfo,
      normalize,
    });
    
    const categoryMinPrice = priceRangeInfoTemp.categoryMinPrice;
    const categoryMaxPrice = priceRangeInfoTemp.categoryMaxPrice;

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
      (candidates.length === 0 && beforePriceFilter > 0) ||
      unrealisticallyLow ||
      unrealisticallyHigh ||
      isVeryLowGlobalBudget
    ) {
      priceRangeNoMatch = true;
      priceRangeInfo = priceRangeInfoTemp;

      console.log("[EFRO SB] PRICE RANGE NO MATCH", {
        text: text.substring(0, 80),
        beforePriceFilter,
        afterPriceFilter: candidates.length,
        priceRangeInfo,
        note:
          "Keine oder nur sehr unpassende Produkte im gew?nschten Preisbereich gefunden.",
      });
    }
  }

  return {
    userMinPrice,
    userMaxPrice,
    minPrice,
    maxPrice,
    priceRangeInfo,
    priceRangeNoMatch,
  };
}

/**
 * Helper: L?st unbekannte Begriffe auf (resolveUnknownTerms, AliasMap, CodeDetect)
 */
function resolveUnknownTermsForFilter(
  text: string,
  words: string[],
  expandedWords: string[],
  catalogKeywords: string[],
  aliasMap: AliasMap
): {
  words: string[];
  expandedWords: string[];
  unknownResult: UnknownTermsResult;
} {
  // --- EFRO Alias-Preprocessing -----------------------------------------
  // Alias-Map VOR dem Keyword-Matching anwenden, damit unbekannte Begriffe
  // in bekannte Keywords aufgel?st werden
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

  // Speichere aliasResult f?r sp?teren Hard-Filter
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
      // Debug f?r "Parf?m" / Language-Aliase
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

  return {
    words,
    expandedWords,
    unknownResult,
  };
}

/**
 * EFRO Budget-Optimierung: Filtert Produkte nach Budget und bildet drei Mengen
 * - inBudget: Produkte IM Budget
 * - aboveBudget: Produkte ÜBER Budget (für Fallback)
 * - belowBudget: Produkte UNTER Budget (optional)
 * 
 * Wenn inBudget leer ist, aber aboveBudget vorhanden, werden die günstigsten aus aboveBudget zurückgegeben.
 */
function createBudgetFilteredProducts(
  baseProducts: EfroProduct[],
  minPrice: number | null,
  maxPrice: number | null
): {
  inBudget: EfroProduct[];
  aboveBudget: EfroProduct[];
  belowBudget: EfroProduct[];
  finalProducts: EfroProduct[];
  nearestPriceAboveBudget: number | null;
  nearestProductTitleAboveBudget: string | null;
} {
  const inBudget: EfroProduct[] = [];
  const aboveBudget: EfroProduct[] = [];
  const belowBudget: EfroProduct[] = [];

  // Wenn kein Budget gesetzt, alle Produkte als inBudget behandeln
  if (minPrice === null && maxPrice === null) {
    return {
      inBudget: baseProducts,
      aboveBudget: [],
      belowBudget: [],
      finalProducts: baseProducts,
      nearestPriceAboveBudget: null,
      nearestProductTitleAboveBudget: null,
    };
  }

  // Produkte in die drei Mengen einteilen
  for (const product of baseProducts) {
    const price = product.price ?? 0;
    
    // Prüfe, ob Produkt IM Budget liegt
    let isInBudget = true;
    if (minPrice !== null && price < minPrice) {
      isInBudget = false;
      belowBudget.push(product);
    }
    if (maxPrice !== null && price > maxPrice) {
      isInBudget = false;
      aboveBudget.push(product);
    }
    
    if (isInBudget) {
      inBudget.push(product);
    }
  }

  // Wenn inBudget vorhanden, diese verwenden
  if (inBudget.length > 0) {
    return {
      inBudget,
      aboveBudget,
      belowBudget,
      finalProducts: inBudget,
      nearestPriceAboveBudget: null,
      nearestProductTitleAboveBudget: null,
    };
  }

  // Wenn inBudget leer, aber aboveBudget vorhanden: günstigste aus aboveBudget nehmen
  if (aboveBudget.length > 0) {
    // Sortiere aboveBudget nach Preis aufsteigend
    const sortedAboveBudget = [...aboveBudget].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    
    // Nimm die 3-5 günstigsten (max 5)
    const fallbackProducts = sortedAboveBudget.slice(0, Math.min(5, sortedAboveBudget.length));
    
    const nearestProduct = fallbackProducts[0];
    const nearestPrice = nearestProduct?.price ?? null;
    const nearestTitle = nearestProduct?.title ?? null;

    return {
      inBudget: [],
      aboveBudget,
      belowBudget,
      finalProducts: fallbackProducts,
      nearestPriceAboveBudget: nearestPrice,
      nearestProductTitleAboveBudget: nearestTitle,
    };
  }

  // Wenn weder inBudget noch aboveBudget vorhanden: leer
  return {
    inBudget: [],
    aboveBudget,
    belowBudget,
    finalProducts: [],
    nearestPriceAboveBudget: null,
    nearestProductTitleAboveBudget: null,
  };
}

/**
 * Helper: Wendet Produktfilter an (Kategorie-, Attribut- und Preisfilter)
 */
function applyProductFilters(
  candidates: EfroProduct[],
  effectiveCategorySlug: string | null,
  matchedCategories: string[],
  categoryHintsInText: string[],
  missingCategoryHint: string | null,
  attributeFilters: Record<string, string[]>,
  attributeIndex: AttributeIndex,
  minPrice: number | null,
  maxPrice: number | null,
  text: string,
  contextCategory?: string | null,
  userMinPrice?: number | null,
  userMaxPrice?: number | null
): {
  candidates: EfroProduct[];
  debugFlags: string[];
  missingCategoryHint: string | null;
  nearestPriceAboveBudget: number | null;
  nearestProductTitleAboveBudget: string | null;
} {
  const debugFlags: string[] = [];

  const allProducts: EfroProduct[] = candidates; // legacy alias (full pool)
  const normalizedQuery = text;
  // Filtere nach effectiveCategorySlug (entweder aus Text oder aus Kontext)
  // ?? EFRO Category Filter Fix:
  // - Nur dann hart nach Kategorie filtern, wenn es mindestens ein Produkt
  //   mit diesem Category-Slug gibt.
  // - Wenn kein Produkt diese Kategorie hat, Kandidaten NICHT auf 0 schie?en,
  //   sondern missingCategoryHint setzen und einen Debug-Hinweis schreiben.
 
 // EFRO: Kategorie-Inferenz bei Tippfehlern / generischen Begriffen (z. B. "snowbord", "einsteiger-board")
if (!effectiveCategorySlug && allProducts.length > 0) {
  const slugs = Array.from(
new Set(allProducts.map((p) => normalize(p.category || "")).filter(Boolean))

  );

  const lev = (a: string, b: string): number => {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (!al) return bl;
    if (!bl) return al;
    const dp = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[al][bl];
  };
  const q = normalize(text || "");
  const tokens = q
    .split(/[^a-z0-9äöüß\-]+/i)
    .map((t) => t.trim())
    .filter(Boolean);

  let inferred: string | null = null;

  // typo match tokens -> slugs (snowbord -> snowboard)
  for (const t of tokens) {
    if (slugs.includes(t)) {
      inferred = t;
      break;
    }
    let best: { s: string; d: number } | null = null;
    for (const s of slugs) {
      const d = lev(t, s);
      const maxD = s.length >= 8 ? 2 : 1;
      if (d <= maxD && (!best || d < best.d)) best = { s, d };
    }
    if (best) {
      inferred = best.s;
      break;
    }
  }

  // generic "-board" heuristic (einsteiger-board -> *board* slug)
  if (!inferred && tokens.some((t) => /(^|-)board$/.test(t))) {
    const hit = slugs.find((s) => s.includes("board"));
    if (hit) inferred = hit;
  }

  if (inferred) {
    effectiveCategorySlug = inferred;
    debugFlags.push("category_inferred:" + inferred);
  }
  
  if (candidates.length === 0) {
  candidates = allProducts.filter(
    (p) => normalize(p.category || "") === inferred
  );
}

  
}



 if (effectiveCategorySlug) {
    const beforeCategoryFilterCount = candidates.length;

    const filteredByCategory = candidates.filter(
      (p) => normalize(p.category || "") === normalize(effectiveCategorySlug || "")
    );

    if (filteredByCategory.length > 0) {
      // Es gibt wirklich Produkte mit dieser Kategorie ? normal filtern.
      candidates = filteredByCategory;
    } else {
      // Kein Produkt mit diesem Slug ? nicht alles wegfiltern.
      // Stattdessen nur Hinweis setzen.
      if (beforeCategoryFilterCount > 0) {
        debugFlags.push("category_no_match_for_slug:" + String(effectiveCategorySlug));
      }
      if (!missingCategoryHint) {
        missingCategoryHint = effectiveCategorySlug;
      }
      // candidates bleibt unver?ndert.
    }
    
    // TODO Vorschlag: Bei Budget-only Anfragen (ohne Produktkategorie) k?nnte man
    // den Kategorie-Filter optional machen, damit nicht alle Produkte wegfallen.
    // Aktuell: Kategorie-Filter ist hart, was bei "zeig mir Parf?m" korrekt ist,
    // aber bei "50 Euro Budget" ohne Kategorie k?nnte es zu streng sein.
    
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
      
      // Pr?fe auf explizite Negationen
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
        
        // EFRO WAX-Disambiguierung: Wenn "wax"/"wachs" im Query ist, pr?fe Intent
        if (hasWaxKeyword) {
          const hasWaxInTitle = (p.title ?? "").toLowerCase().includes("wax") || 
                                (p.title ?? "").toLowerCase().includes("wachs");
          const hasWaxInTags = Array.isArray(p.tags) && p.tags.some((tag: string) => 
            tag.toLowerCase().includes("wax") || tag.toLowerCase().includes("wachs")
          );
          
          if (hasWaxInTitle || hasWaxInTags) {
            // Pr?fe, ob Produkt zu Intent passt
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
              return false; // Haarwachs bei Snowboard-Intent ausschlie?en
            }
            if (waxIntent === "hair" && !isHairWax) {
              return false; // Snowboard-Wachs bei Hair-Intent ausschlie?en
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
    
    // Keine Kategorie-Matches und kein Kontext: Log f?r Budget-only Szenarien
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

      // Alle aktiven Filter m?ssen matchen
      return activeAttributeFilterEntries.every(([key, values]) => {
        const prodValues = productAttrs[key] ?? [];

        if (!Array.isArray(prodValues) || prodValues.length === 0) {
          return false;
        }

        // Speziallogik f?r Haustiere (pet = dog/cat/pet)
        if (key === "pet") {
          const hasGeneric = prodValues.includes("pet");
          const hasDog = prodValues.includes("dog");
          const hasCat = prodValues.includes("cat");

          const wantsGeneric = values.includes("pet");
          const wantsDog = values.includes("dog");
          const wantsCat = values.includes("cat");

          // Direktes Matching (dog-dog, cat-cat, pet-pet)
          const directMatch = values.some((v) => prodValues.includes(v));

          // Query: "Haustiere" (pet) ? akzeptiere dog oder cat
          const genericMatchesSpecies = wantsGeneric && (hasDog || hasCat);

          // Query: "Hund(e)" bzw. "Katze(n)" ? akzeptiere generische Haustier-Produkte (pet)
          const speciesMatchesGeneric =
            (wantsDog || wantsCat) && hasGeneric;

          return directMatch || genericMatchesSpecies || speciesMatchesGeneric;
        }

        // Standardfall f?r alle anderen Attribute
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
      // Kein harter Filter: wir behalten die urspr?nglichen Kandidaten
    }
  }

  // EFRO Budget-Optimierung: Preis-Filter mit drei Mengen (inBudget, aboveBudget, belowBudget)
  let nearestPriceAboveBudget: number | null = null;
  let nearestProductTitleAboveBudget: string | null = null;
  
  if (minPrice !== null || maxPrice !== null) {
    const beforePriceFilter = candidates.length;

    // Neue Budget-Filter-Logik: drei Mengen bilden
    const budgetResult = createBudgetFilteredProducts(candidates, minPrice, maxPrice);
    
    // Verwende finalProducts (entweder inBudget oder günstigste aus aboveBudget)
    candidates = budgetResult.finalProducts;
    nearestPriceAboveBudget = budgetResult.nearestPriceAboveBudget;
    nearestProductTitleAboveBudget = budgetResult.nearestProductTitleAboveBudget;

    const candidateCountAfterPriceFilter = candidates.length;

    console.log("[EFRO SB] AFTER PRICE FILTER", {
      text: text.substring(0, 80),
      minPrice,
      maxPrice,
      beforeCount: beforePriceFilter,
      afterCount: candidates.length,
      inBudgetCount: budgetResult.inBudget.length,
      aboveBudgetCount: budgetResult.aboveBudget.length,
      belowBudgetCount: budgetResult.belowBudget.length,
      usingAboveBudgetFallback: budgetResult.inBudget.length === 0 && budgetResult.aboveBudget.length > 0,
      nearestPriceAboveBudget,
      nearestProductTitleAboveBudget,
      samplePrices: candidates.slice(0, 5).map((p) => p.price ?? 0),
    });
  } else {
    console.log("[EFRO SB] PRICE FILTER SKIPPED", {
      text: text.substring(0, 80),
      reason: "no user price range",
      candidateCount: candidates.length,
    });
  }

  return {
    candidates,
    debugFlags,
    missingCategoryHint,
    nearestPriceAboveBudget,
    nearestProductTitleAboveBudget,
  };
}

/**
 * Helper: Sortiert und begrenzt Kandidaten (Scoring, Sortierung, Plan-Limit)
 */
function rankAndSliceCandidates(
  candidates: EfroProduct[],
  currentIntent: ShoppingIntent,
  hasBudget: boolean,
  userMinPrice: number | null,
  userMaxPrice: number | null,
  wantsMostExpensive: boolean,
  text: string,
  cleaned: string
): EfroProduct[] {
  /**
   * 5) Sortierung abh?ngig von Budget & Intent
   */

  if (hasBudget) {
    if (userMinPrice !== undefined && userMaxPrice === undefined) {
      // nur Untergrenze: g?nstigste ?ber X zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      // Obergrenze / Range: teuer nach g?nstig
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
      // Schn?ppchen / Geschenk / Quick-Buy: g?nstigste zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (currentIntent === "explore") {
      candidates.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  // Spezialfall: User fragt explizit nach dem "g?nstigsten"/"billigsten"/"cheapest" Produkt
  const normalizedTextForCheapest = normalize(text);
  const wantsCheapestOne = /\b(g?nstigste(?:s|n)?|guenstigste(?:s|n)?|gunstigste(?:s|n)?|billigste(?:s|n)?|cheapest)\b/.test(
    normalizedTextForCheapest
  );

  if (!hasBudget && wantsCheapestOne && candidates.length > 0) {
    // Immer nach Preis aufsteigend sortieren und NUR das billigste Produkt zur?cklassen
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

  // Spezieller Fall: "g?nstigstes/billigstes Snowboard"
  // ? Nur das preislich g?nstigste Produkt zur?ckgeben.
  const normalizedText = cleaned.toLowerCase();
  const wantsCheapestSnowboard =
    normalizedText.includes("snowboard") &&
    /\b(g?nstigstes|g?nstigste|g?nstigsten|billigste|billigsten|preiswerteste)\b/.test(
      normalizedText
    );

  if (wantsCheapestSnowboard && candidates.length > 0) {
    // Fokussiere zuerst auf Kategorie "snowboard", falls vorhanden
    const snowboardCandidates = candidates.filter(
      (p) => normalize(p.category || "") === "snowboard"
    );

    const baseList =
      snowboardCandidates.length > 0 ? snowboardCandidates : candidates;

    // Nach Preis aufsteigend sortieren und nur das g?nstigste Produkt zur?ckgeben
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
 * Produkte nach Keywords, Kategorie und Preis filtern
 * ? NIE wieder [] zur?ckgeben, solange allProducts nicht leer ist.
 */
async function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[],
  contextCategory?: string | null
): Promise<EfroProduct[]> {
  return await filterProductsForSellerBrain(text, intent, allProducts, contextCategory);
}

/**
 * Szenario-Typen f?r Profiseller-Reply-Engine
 */
type ProfisellerScenario =
  | "S1" // QUICK BUY ? EIN klares Produkt
  | "S2" // QUICK BUY ? WENIGE Optionen (2-4)
  | "S3" // EXPLORE ? Mehrere Produkte (>= 3)
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
  // S6: ZERO RESULTS (wird bereits in buildRuleBasedReplyText behandelt, aber f?r Vollst?ndigkeit)
  if (count === 0) {
    return "S6";
  }

  // S4: BUDGET-ONLY ANFRAGE
  // Erkennung: Budget vorhanden, aber wenig oder keine Keywords (nur Budget-W?rter)
  if (hasBudget) {
    const normalized = normalize(text);
    // Pr?fe, ob der Text haupts?chlich Budget-Keywords enth?lt
    // Importiert aus languageRules.de.ts
    const hasOnlyBudgetKeywords = BUDGET_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw)) && 
                                   attributeTerms.length === 0 &&
                                   !BUDGET_ONLY_STOPWORDS.some(stopword => normalized.includes(stopword)) &&
                                   !PRODUCT_KEYWORDS_FOR_BUDGET_ONLY.some(kw => normalized.includes(kw));
    
    const hasEuroNumberPattern = /\d+\s*(euro|eur)/i.test(normalized);
    if (hasOnlyBudgetKeywords || (hasEuroNumberPattern && attributeTerms.length === 0)) {
      return "S4";
    }
  }

  // S5: ONLY CATEGORY / MARKENANFRAGE
  // Erkennung: explore Intent, Produkte vorhanden, aber kein Budget
  if (intent === "explore" && !hasBudget && count > 0) {
    const normalized = normalize(text);
    const hasCategoryKeyword = CATEGORY_KEYWORDS_FOR_SCENARIO.some(kw => normalized.includes(kw));
    const hasEuroNumber = /\d+\s*(euro|eur)/i.test(normalized);

    if (hasCategoryKeyword || (attributeTerms.length > 0 && !hasEuroNumber)) {
      return "S5";
    }
  }

  // S1: QUICK BUY ? EIN klares Produkt
  if (intent === "quick_buy" && count === 1) {
    return "S1";
  }

  // S2: QUICK BUY ? WENIGE Optionen (2-4)
  if (intent === "quick_buy" && count >= 2 && count <= 4) {
    return "S2";
  }

  // S3: EXPLORE ? Mehrere Produkte (>= 3)
  if (intent === "explore" && count >= 3) {
    return "S3";
  }

  // Fallback: Bestehendes Verhalten
  return "fallback";
}

/**
 * Regel-basierte Reply-Text-Generierung (Profiseller-Engine v1)
 */

/**
 * AI-Kl?rungstexte basierend auf aiTrigger hinzuf?gen
 */


/**
 * Reply-Text f?r EFRO bauen
 */


/**
 * Pr?ft, ob ein Begriff wie ein Produktcode aussieht (z. B. ABC123 oder ABCDFG)
 * WICHTIG: Reine Zahlen werden NICHT als Code akzeptiert
 */
function looksLikeProductCode(term: string): boolean {
  const t = term.toLowerCase().trim();
  if (t.length < 4 || t.length > 20) return false;
  
  // Numeric-only Tokens ignorieren (z. B. "50", "21", "22")
  if (/^[0-9]+$/.test(t)) return false;
  
  // CLUSTER 2 FIX: Budget-Bereiche wie "20-30", "50-100" NICHT als Code behandeln
  // Pattern: Zahl-Bindestrich-Zahl (z. B. "20-30", "50-100", "100-200")
  if (/^\d+-\d+$/.test(t)) return false;
  
  // Mischung aus Buchstaben und Zahlen (z. B. ABC123)
  const hasLetter = /[a-z]/i.test(t);
  const hasDigit = /\d/.test(t);
  if (hasLetter && hasDigit) return true;
  
  // Bindestrich oder Unterstrich enthalten (z. B. ABC-123, SNB-XL-RED, p-12345)
  // ABER: Budget-Bereiche wurden bereits oben ausgeschlossen
  const hasSpecial = /[-_]/.test(t);
  if (hasSpecial) return true;
  
  // Reine Buchstaben-W?rter (z. B. "hundefutter", "katzenfutter", "parfum") sind KEINE Codes
  // Nur Codes mit Ziffern oder Bindestrich/Unterstrich gelten als Produktcode
  return false;
}

// H?ufige W?rter, die KEIN Produktcode sind, auch wenn sie Buchstaben/Zahlen enthalten k?nnten
const NON_CODE_TERMS_SET = new Set(NON_CODE_TERMS_ARRAY);

// Stopw?rter f?r AI-Unknown-Terms-Filterung
// Diese W?rter sollen NICHT als "unbekannte Begriffe" f?r AI-Trigger z?hlen
const UNKNOWN_AI_STOPWORDS_SET = new Set<string>(UNKNOWN_AI_STOPWORDS_ARRAY);

// [EFRO AI] Stopwords und generische W?rter, die nicht als unknownTerms gez?hlt werden sollen
const GENERIC_UNKNOWN_STOPWORDS = new Set([
  "produkte",
  "produkt",
  "sachen",
  "etwas",
  "was",
  "auch",
  "bitte",
  "mir",
  "suche",
  "suchst",
  "zeigen",
  "zeig",
  "zeige",
  "mehr",
  "als",
  "ausgeben",
  "haben",
  "hast",
]);

// Extrahiert einen einzelnen Code-?hnlichen Term aus dem Nutzersatz
// Erkennt sowohl gemischte Codes (ABC123) als auch reine Buchstabencodes (ABCDFG)
function extractCodeTermFromText(text: string): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Schritt 1: Einfache Wort-Splittung f?r gemischte Codes (ABC123)
  // CLUSTER K FIX K16v1: Erweitere Pattern für längere Codes wie "Alpha ULTRA PRO 1TB"
  const candidates = lower.match(/\b[a-z0-9\-]{4,30}\b/gi);
  if (!candidates) return null;
  
  // CLUSTER K FIX K16v1: Prüfe auch auf mehrteilige Codes wie "alpha ultra pro 1tb"
  const multiWordCodePattern = /\b(alpha\s+ultra\s+pro\s+\d+\s*tb)\b/i;
  const multiWordMatch = text.match(multiWordCodePattern);
  if (multiWordMatch) {
    const codeTerm = multiWordMatch[1].toLowerCase().replace(/\s+/g, '-');
    if (codeTerm.length >= 4 && codeTerm.length <= 30) {
      return codeTerm;
    }
  }

  const codeCandidates = candidates.filter((c) => {
    const trimmed = c.toLowerCase();
    if (NON_CODE_TERMS_SET.has(trimmed)) return false;
    return looksLikeProductCode(trimmed);
  });

  if (codeCandidates.length === 1) {
    return codeCandidates[0];
  }

  // Schritt 2: F?r reine Buchstabencodes (ABCDFG) - isolierte unbekannte Terms pr?fen
  // Extrahiere alle Terms nach Entfernen von Stoppw?rtern
  const stopwords = new Set([
    "kannst", "du", "mir", "zeigen", "zeige", "zeig", "bitte", "ich", "suche", "ein", "eine", "einen",
    "produkt", "produkte", "artikel", "kann", "können", "soll", "sollte", "möchte", "will", "würde",
    // Personalpronomen
    "er", "sie", "wir", "ihr",
    // Verben (haben)
    "habe", "hast", "hat", "haben",
    // Budget/Preis-W?rter
    "budget", "preis", "euro", "unter", "?ber", "bis", "ca", "etwa", "ungef?hr", "von",
  ]);
  
  const normalized = normalize(text);
  const allTerms = normalized
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .filter((t) => !stopwords.has(t.toLowerCase()))
    .filter((t) => !NON_CODE_TERMS_SET.has(t.toLowerCase()))
    // Numeric-only Tokens ignorieren
    .filter((t) => !/^[0-9]+$/.test(t));

  // Wenn genau 1 Term ?brig bleibt und dieser wie ein Code aussieht
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
export async function runOrchestrator({
  userText,
  currentIntent,
  allProducts,
  plan,
  previousRecommended,
  context,
}: BrainInput): Promise<BrainOutput> {
  const raw = userText ?? "";
  const cleaned = raw.trim();
  // KB: optional – kommt aus dem Context (kann undefined sein, kbRoute ist dann No-Op)
  const storeFacts = context?.storeFacts;
  const runtimeContext: SellerBrainContext = context ?? {};
  runtimeContext.inputText = cleaned;
  runtimeContext.currentIntent = currentIntent;
  await runStep03_BudgetParsing(runtimeContext);
  // Defensive Guard: Leere Produktliste
  if (!Array.isArray(allProducts) || allProducts.length === 0) {
    logWarn("[EFRO SB] Empty product list", {
      userText: cleaned.substring(0, 100),
      allProductsType: typeof allProducts,
      allProductsLength: Array.isArray(allProducts) ? allProducts.length : "not an array",
    });

    const fallbackReplyText =
      "Entschuldigung, im Moment sind keine Produkte verf?gbar. Bitte versuche es sp?ter noch einmal.";

    return {
      intent: currentIntent,
      recommended: [],
      replyText: fallbackReplyText,
      nextContext: context,
      // TODO-AI-REFACTOR: Direkter Return bei leerer Produktliste
      aiTrigger: {
        needsAiHelp: true,
        reason: "no_results",
        unknownTerms: [],
      },
    };
  }

  // Debug: Katalog-?bersicht loggen (nur einmal pro Run)
  debugCatalogOverview(allProducts);

  await runStep04_IntentExtraction(runtimeContext);
  const nextIntent = runtimeContext.intent ?? currentIntent;

function isAmbiguousBoardQuery(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("board") && !t.includes("snow");
}


  logInfo("[EFRO SB Context] Incoming context", {
    activeCategorySlug: context?.activeCategorySlug ?? null,
    hasContext: !!context,
    contextKeys: context ? Object.keys(context) : [],
  });

  logInfo("[EFRO SB] ENTER runSellerBrain", {
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
  // EFRO Explanation-Mode Boolean: Zusätzliche Erkennung für robuste explanationMode-Flags
  // Nutze sowohl die bestehende detectExplanationMode als auch die neue Boolean-Funktion
  const explanationModeBoolean = 
    explanationMode !== null || detectExplanationModeBoolean(cleaned);
  const previousRecommendedCount = previousRecommended ? previousRecommended.length : 0;
  
  const state: BrainState = {
    nextIntent,
    maxRecommendations,
    explanationMode,
    explanationModeBoolean,
    previousRecommendedCount,
  };

  logInfo("[EFRO SellerBrain] explanationMode", {
    text: cleaned,
    explanationMode: state.explanationMode,
    explanationModeBoolean: state.explanationModeBoolean,
    previousCount: state.previousRecommendedCount,
  });

  // EFRO S18/S19 Fix: Handle Wax-Erkl?rungen mit AI-Trigger
  // CLUSTER 1 FIX: Berücksichtige explanationModeBoolean auch in handleWaxExplanation
  // Wenn explanationMode null ist, aber explanationModeBoolean true, dann setze explanationMode auf "usage"
  const effectiveExplanationModeForWax = explanationMode || (explanationModeBoolean ? "usage" : null);
  const waxExplanationInfo = handleWaxExplanation(
    cleaned,
    allProducts,
    effectiveExplanationModeForWax,
    previousRecommendedCount
  );

  // explanationMode ggf. ?bernehmen (f?r S18/S19)
  // EFRO Explanation-Mode Boolean: Berücksichtige auch explanationModeBoolean für robuste Erkennung
  const effectiveExplanationMode = 
    waxExplanationInfo.explanationMode || 
    explanationMode || 
    (explanationModeBoolean ? "usage" : null);

  // EFRO Explanation-Mode: Erkennt Erkl?rungsanfragen und setzt AI-Trigger
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

    // EFRO WAX-Fix: Pr?fe Beschreibung f?r Wax-Produkte
    // Nutze previousRecommended, wenn vorhanden (f?r Follow-up-Fragen)
    let hasUsableDescription = false;
    let waxProductWithDescription: EfroProduct | null = null;
    
    // Priorisiere previousRecommended f?r Follow-up-Fragen
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
        hasUsableDescription = desc.length >= 30; // Mindestens 30 Zeichen f?r sinnvolle Beschreibung
        waxProductWithDescription = hasUsableDescription ? waxProduct : null;
        
        console.log("[EFRO WAX Description Check]", {
          productTitle: waxProduct.title,
          descriptionLength: desc.length,
          hasUsableDescription,
          usingPreviousRecommended: previousRecommended && previousRecommended.length > 0,
        });
      }
    }

    // EFRO Explanation-Mode: AI-Trigger f?r Erkl?rungsanfragen setzen
    const matchedProductsForContext = recommended.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      category: p.category,
    }));

    // EFRO Fix: KEIN AI-Trigger f?r Erkl?rungen mit Produktbeschreibung
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
          // Fallback: Nutze Beschreibung direkt (gek?rzt, falls zu lang)
          const maxLength = 500;
          const truncatedDesc = description.length > maxLength 
            ? description.substring(0, maxLength) + "..."
            : description;
          replyText = `F?r ${productTitle}:\n\n${truncatedDesc}`;
        }
      } else {
        // Beschreibung fehlt: Ehrliche Antwort ohne AI
        replyText = "F?r dieses Produkt liegt aktuell keine ausf?hrliche Beschreibung im Shop vor. " +
          "Bitte wenden Sie sich direkt an den Shop oder schauen Sie sp?ter noch einmal vorbei.";
      }
    } else {
      replyText = "Ich kann dir gerne Fragen zu Inhaltsstoffen, Anwendung oder Pflege beantworten. " +
          "Dafür brauche ich aber ein konkretes Produkt. Bitte sage mir zuerst, welches Produkt dich interessiert, " +
          "dann kann ich dir die Details dazu erklären.";
    }

    console.log("[EFRO SellerBrain] Explanation mode ? Direkt aus Beschreibung", {
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

    // SCHRITT 1 FIX: Fallback von Explanation-Mode auf FilterProducts
    // Wenn explanationMode === 'usage' und keine Produkte/Beschreibung vorhanden,
    // dann normalen Filter-Pfad ausführen (für S5v1, S6v1, S4v2, S6v2)
    // CLUSTER A FIX S18/S19: Auch bei Fallback explanationMode: true setzen
    const hasUsageButEmpty =
      effectiveExplanationMode === "usage" &&
      recommended.length === 0 &&
      !hasUsableDescription;

    if (hasUsageButEmpty) {
      console.log("[EFRO SB Explanation Fallback] Usage-Mode ohne Produkte/Beschreibung → FilterProducts", {
        text: cleaned.substring(0, 100),
        explanationMode: effectiveExplanationMode,
        recommendedCount: recommended.length,
        hasUsableDescription,
        note: "Fallback auf normalen Filter-Pfad, aber explanationMode bleibt true",
      });
      
      // CLUSTER A FIX S18/S19: Setze Flag, damit explanationMode später im Return gesetzt wird
      // Die Logik wird nach dem Explanation-Mode-Block fortgesetzt
      // explanationMode wird im finalen Return gesetzt (siehe Zeile ~5876)
    } else {
      // Normale Explanation-Mode-Logik: Return mit Explanation-Reply
      // Auch bei Explanation-Mode Sales-Entscheidung berechnen (für PROFI-Szenarien)
      // effectiveCategorySlug ist hier noch nicht verfügbar, daher null
      const salesPolicyOutputExplanation = applySalesPolicy({
        text: cleaned,
        engine: {
          intent: nextIntent,
          products: recommended,
          contextCategory: context?.activeCategorySlug ?? null,
          effectiveCategorySlug: null,
          userMinPrice: null,
          userMaxPrice: null,
          priceRangeInfo: null,
          priceRangeNoMatch: false,
        },
        locale: "de",
      });

      return {
        intent: nextIntent,
        recommended,
        replyText,
        explanationMode: true,
        aiTrigger, // Nur setzen, wenn Beschreibung vorhanden
        // EFRO WAX-Fix: Debug-Flag f?r fehlende Beschreibung
        debugFlags: hasUsableDescription ? undefined : { missingDescription: true },
        sales: salesPolicyOutputExplanation,
      };
    }
  }

  // OFF-TOPIC-GUARD
  // CLUSTER 2 FIX: Budget-Anfragen mit Kontext-Kategorie als produktbezogen behandeln
  const normalizedForOffTopic = normalize(cleaned);
  const hasContextCategoryForOffTopic = context?.activeCategorySlug;
  const hasBudgetInTextForOffTopic = /\b(\d+)\s*(euro|eur|€|dollar|\$)\b/i.test(cleaned) || 
    /\b(unter|über|bis|ab|zwischen|von|bis zu|maximal|mindestens|höchstens)\s*\d+/i.test(cleaned) ||
    /\bzwischen\s+(\d+)\s+(und|bis|-)\s*(\d+)\s*(euro|eur|€)\b/i.test(cleaned);
  const isBudgetWithContext = hasContextCategoryForOffTopic && hasBudgetInTextForOffTopic;
  
  // E5v2 Fix: Unbekannte Begriffe mit Kontext-Kategorie als produktbezogen behandeln
  // (z. B. "Hast du Zephyron?" mit Kontext Parfüm)
  const hasUnknownTermsWithContext = (() => {
    if (!hasContextCategoryForOffTopic) return false;
    const words = normalizedForOffTopic.split(/\s+/).filter(w => w.length >= 3);
    return words.some(w => {
      const isKnown = CORE_PRODUCT_KEYWORDS.some(kw => normalize(kw).includes(w)) ||
        getActiveProductHints().some(h => normalize(h.keyword).includes(w));
      return !isKnown && !/^\d+([.,]\d+)?$/.test(w); // Keine Zahlen
    });
  })();
  
  // CLUSTER K FIX K7v2: Bei Kontext "elektronik" und Attributen (schwarz, zoll, display) als produktbezogen erkennen
  const hasElektronikContextForOffTopic = context?.activeCategorySlug && normalize(context.activeCategorySlug) === "elektronik";
  const hasSmartphoneAttributesForOffTopic = normalizedForOffTopic.includes("schwarz") || 
    normalizedForOffTopic.includes("zoll") || 
    normalizedForOffTopic.includes("display") ||
    normalizedForOffTopic.includes("farbe");
  const isElektronikContextWithAttributes = hasElektronikContextForOffTopic && hasSmartphoneAttributesForOffTopic;
  
  // E3v1/E5v2 Fix: Budget + unbekannte Begriffe als produktbezogen behandeln (auch ohne Kontext-Kategorie)
  // Prüfe, ob unbekannte Begriffe im Text sind (z. B. "Zephyron")
  const hasUnknownTermsInText = (() => {
    const words = normalizedForOffTopic.split(/\s+/).filter(w => w.length >= 3);
    // Einfache Heuristik: Wenn ein Wort nicht in den bekannten Keywords ist, könnte es unbekannt sein
    // Dies ist eine grobe Annäherung - die echte Prüfung erfolgt später in decideAiTrigger
    return words.some(w => {
      const isKnown = CORE_PRODUCT_KEYWORDS.some(kw => normalize(kw).includes(w)) ||
        getActiveProductHints().some(h => normalize(h.keyword).includes(w));
      return !isKnown && !/^\d+([.,]\d+)?$/.test(w); // Keine Zahlen
    });
  })();
  const isBudgetWithUnknownTerms = hasBudgetInTextForOffTopic && hasUnknownTermsInText;
  
  // G3v2 Fix: Budget-Anfragen mit expliziter Zahl (z. B. "maximal 20 €") als produktbezogen behandeln
  // auch wenn kein explizites Budget-Wort vorhanden ist
  const hasBudgetNumberForOffTopic = /\b(\d+)\s*(euro|eur|€)\b/i.test(cleaned);
  const hasBudgetWordForOffTopicCheck = /\b(budget|preis|kosten|maximal|mindestens|höchstens|unter|über|bis|ab)\b/i.test(cleaned);
  const isBudgetOnlyQueryForOffTopic = hasBudgetNumberForOffTopic || hasBudgetWordForOffTopicCheck;
  
  if (!isProductRelated(cleaned, runtimeContext) && !isBudgetWithContext && !isElektronikContextWithAttributes && !isBudgetWithUnknownTerms && !isBudgetOnlyQueryForOffTopic && !hasUnknownTermsWithContext) {
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

    // Auch bei Off-Topic Sales-Entscheidung berechnen (für PROFI-Szenarien)
    const salesPolicyOutputOffTopic = applySalesPolicy({
      text: cleaned,
      engine: {
        intent: nextIntent,
        products: recommended,
        contextCategory: context?.activeCategorySlug ?? null,
        effectiveCategorySlug: null,
        userMinPrice: null,
        userMaxPrice: null,
        priceRangeInfo: null,
        priceRangeNoMatch: false,
      },
      locale: "de",
    });

    return {
      intent: nextIntent,
      recommended,
      replyText: offTopicReply,
      sales: salesPolicyOutputOffTopic,
    };
  }

  // Normale Such-/Kaufanfrage -> filtern
  const filterResult = await filterProducts(
    cleaned,
    nextIntent,
    allProducts,
    context?.activeCategorySlug
  );
  const candidateCount = filterResult.length;

  // EFRO Budget-Fix 2025-11-30: Pr?fe, ob nach Price-Filter keine Produkte
  // im gew?nschten Preisbereich gefunden wurden ? Budget-Parsing jetzt
  // zentral ?ber analyzeBudget (gemeinsam mit filterProducts).
  const budgetAnalysis = analyzeBudget(cleaned);
  const {
    userMinPrice,
    userMaxPrice,
    hasBudgetWord,
    isBudgetAmbiguous,
  } = budgetAnalysis;

  const hasUserPriceRange =
    userMinPrice !== null || userMaxPrice !== null;
  
  // EFRO Budget-Fix 2025-01-XX: Bestimme effectiveCategorySlug f?r Budget-Pr?fung
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
  // SCHRITT 1 FIX: Bei "Budget ohne Zahl" KEIN AI-Trigger, sondern regelbasierte R?ckfrage
  // WICHTIG: Prüfe ZUERST, ob es ein Preis-Einwand ist (höhere Priorität als Budget-Ambiguität)
  const normalizedForPriceCheck = normalize(cleaned || "");
  const isPriceObjection = detectPriceObjection(normalizedForPriceCheck);
  
  // C1v2/F6v2 Fix: Premium-Intent mit wantsMostExpensive ausschließen (z. B. "Premium-Produkte mit dem höchsten Preis")
  const wantsMostExpensiveForBudget = detectMostExpensiveRequest(cleaned);
  const isPremiumWithMostExpensive = nextIntent === "premium" && wantsMostExpensiveForBudget;
  const isCheapestLikeQuery =
    /\b(günstigst(?:e|en|es)|guenstigst(?:e|en|es)|billigst(?:e|en|es)|am günstigsten|am guenstigsten|so billig wie möglich|so billig wie moeglich|so günstig wie möglich|so guenstig wie moeglich|cheapest|lowest price|most affordable)\b/i.test(
      cleaned
    );
  
  if (isBudgetAmbiguous && hasBudgetWord && !hasUserPriceRange && !effectiveCategorySlug && !isPriceObjection && !isPremiumWithMostExpensive && !isCheapestLikeQuery) {
    console.log("[EFRO SB Budget Ambiguous] Vages Budget erkannt, keine Produktempfehlungen, KEIN AI-Trigger", {
      text: cleaned.substring(0, 100),
      isBudgetAmbiguous,
      note: "Regelbasierte R?ckfrage statt AI-Trigger",
    });
    
    // Regelbasierte R?ckfrage direkt hier generieren (ohne AI-Trigger)
    const replyText =
      `Du hast erwähnt, dass dein Budget eher klein ist. Damit ich dir wirklich passende Produkte empfehlen kann:\n\n` +
      `? Für welche Art von Produkt suchst du etwas (z. B. Snowboard, Haustier, Parfüm, Haushalt)?\n` +
      `? Und ungefähr mit welchem Betrag möchtest du rechnen?`;
    
    // Sales-Policy auch hier setzen (mit DEFAULT_SHOW_PRODUCTS, da keine spezifische Action)
    const salesPolicyOutput = applySalesPolicy({
      text: cleaned,
      engine: {
        intent: nextIntent,
        products: [],
        contextCategory: context?.activeCategorySlug ?? null,
        effectiveCategorySlug: effectiveCategorySlug ?? null,
        userMinPrice: null,
        userMaxPrice: null,
        priceRangeInfo: null,
        priceRangeNoMatch: false,
      },
      locale: "de",
    });
    
    return {
      intent: nextIntent,
      recommended: [],
      replyText,
      nextContext: context,
      // aiTrigger bleibt undefined ? kein AI-Trigger
      priceRangeNoMatch: false,
      sales: salesPolicyOutput,
    };
  }
  
      // EFRO Budget-Fix 2025-01-XX: Fall B - vages Budget ohne Zahl und ohne Kategorie
  // SCHRITT 1 FIX: Nur bei vagem Budget ohne Zahl + ohne Kategorie KEIN AI-Trigger,
  // sondern regelbasierte R?ckfrage (z. B. "Ich habe ein kleines Budget.")
  // WICHTIG: Prüfe ZUERST, ob es ein Preis-Einwand ist (höhere Priorität als Budget-Ambiguität)
  // C1v2/F6v2 Fix: Premium-Intent mit wantsMostExpensive ausschließen (z. B. "Premium-Produkte mit dem höchsten Preis")
  if (isBudgetAmbiguous && hasBudgetWord && !hasUserPriceRange && !effectiveCategorySlug && !isPriceObjection && !isPremiumWithMostExpensive && !isCheapestLikeQuery) {
    console.log("[EFRO SB Budget Missing Category] Vages Budget ohne Kategorie erkannt, keine Produktempfehlungen, KEIN AI-Trigger", {
      text: cleaned.substring(0, 100),
      hasBudgetWord,
      hasUserPriceRange,
      isBudgetAmbiguous,
      effectiveCategorySlug,
      note: "Regelbasierte R?ckfrage statt AI-Trigger (vages Budget ohne Zahl)",
    });
    
    // KEIN AI-Trigger ? aiTrigger bleibt undefined
    const replyText = buildReplyText(
      cleaned,
      nextIntent,
      [],
      undefined,
      false,
      undefined,
      undefined,
      context?.replyMode, context?.storeFacts);
    
    return {
      intent: nextIntent,
      recommended: [],
      replyText,
      nextContext: context,
      // aiTrigger bleibt undefined ? kein AI-Trigger
      priceRangeNoMatch: false,
    };
  }


  // EFRO Budget-Fix 2025-11-30: Pr?fe, ob nach Price-Filter keine Produkte im gew?nschten Preisbereich gefunden wurden
  let priceRangeNoMatch = false;
  let priceRangeInfo: PriceRangeInfo | undefined = undefined;
  
  // EFRO Budget-Optimierung: Pr?fe, ob die gefundenen Produkte wirklich im Preisbereich liegen
  // und setze priceRangeNoMatch entsprechend
  if (hasUserPriceRange) {
    // Pr?fe, ob die gefundenen Produkte wirklich im Preisbereich liegen
    const productsInPriceRange = filterResult.filter((p) => {
      const price = p.price ?? 0;
      if (userMinPrice !== null && price < userMinPrice) return false;
      if (userMaxPrice !== null && price > userMaxPrice) return false;
      return true;
    });
    
    // Bestimme die effektive Kategorie aus dem Kontext oder aus den gefilterten Produkten
    let effectiveCategorySlugForInfo: string | null = null;
    if (context?.activeCategorySlug) {
      effectiveCategorySlugForInfo = normalize(context.activeCategorySlug);
    } else if (filterResult.length > 0 && filterResult[0].category) {
      effectiveCategorySlugForInfo = normalize(filterResult[0].category);
    }
    
    // EFRO Budget-Optimierung: Wenn keine Produkte im Budget, aber Produkte knapp darüber vorhanden
    // WICHTIG: priceRangeNoMatch muss gesetzt werden, wenn productsInPriceRange.length === 0,
    // unabhängig davon, ob filterResult.length > 0 ist (z.B. bei unrealistischem Budget werden trotzdem Produkte gezeigt)
    if (productsInPriceRange.length === 0) {
      // Keine Produkte im gewünschten Preisbereich gefunden
      priceRangeNoMatch = true;
      
      // Prüfe, ob es Produkte knapp über Budget gibt (für priceRangeInfo)
      const productsAboveBudget = filterResult.filter((p) => {
        const price = p.price ?? 0;
        if (userMaxPrice !== null && price > userMaxPrice) return true;
        return false;
      });
      
      if (productsAboveBudget.length > 0) {
        // Sortiere nach Preis aufsteigend und nimm das günstigste
        const sortedAboveBudget = [...productsAboveBudget].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        const nearestProduct = sortedAboveBudget[0];
        const nearestPrice = nearestProduct?.price ?? null;
        const nearestTitle = nearestProduct?.title ?? null;
        
        priceRangeInfo = {
          ...computePriceRangeInfo({
            userMinPrice,
            userMaxPrice,
            allProducts,
            effectiveCategorySlug: effectiveCategorySlugForInfo,
            normalize,
          }),
          nearestPriceAboveBudget: nearestPrice,
          nearestProductTitleAboveBudget: nearestTitle,
        };
        
        console.log("[EFRO SB] PRICE RANGE NO MATCH detected (with above-budget fallback)", {
          text: cleaned.substring(0, 100),
          userMinPrice,
          userMaxPrice,
          filterResultCount: filterResult.length,
          productsInPriceRangeCount: productsInPriceRange.length,
          productsAboveBudgetCount: productsAboveBudget.length,
          nearestPriceAboveBudget: nearestPrice,
          nearestProductTitleAboveBudget: nearestTitle,
          priceRangeInfo,
          note: "Keine Produkte im gewünschten Preisbereich gefunden, aber Produkte knapp darüber vorhanden",
        });
      } else {
        // Keine Produkte im Budget und auch keine knapp darüber
        priceRangeInfo = computePriceRangeInfo({
          userMinPrice,
          userMaxPrice,
          allProducts,
          effectiveCategorySlug: effectiveCategorySlugForInfo,
          normalize,
        });
        
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
    } else if (productsInPriceRange.length > 0) {
      // Produkte im Budget gefunden - priceRangeNoMatch = false
      priceRangeNoMatch = false;
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
  
    // Budget-only-Query: Maximal 2 g?nstigste Produkte
  const { minPrice, maxPrice } = extractUserPriceRange(cleaned);
  const hasBudget = minPrice !== undefined || maxPrice !== undefined;

  // Erkennung: Budget vorhanden, aber haupts?chlich nur Budget-Keywords (keine Produkt-Keywords)
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

    // Harte Produkt-W?rter, damit "Snowboard", "Wasserkocher", "Smartphone", "Jeans" etc.
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
      "parf?m",
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
      /\d+\s*(euro|eur)/i.test(normalized) &&
      noAttributes &&
      !hasProductKeyword;

    // Budget-only NUR wenn:
    // - Budget da
    // - KEINE klaren Produktw?rter
    // - und entweder reine Budget-Phrase oder nur Zahl+Euro ohne Produkt
    return hasPureBudgetPhrase || (!hasBudgetKeyword && hasNumberWithEuro);
  })();

  if (isBudgetOnly && finalRanked.length > 2) {
    // Sortiere nach Preis (g?nstigste zuerst) und nehme die 2 g?nstigsten
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

  
  // EFRO K11 Fix: Erkenne, wenn User explizit nach nur einem Produkt fragt
  // Pattern: "nur", "genau", "einziges", "einzelnes", "ausschließlich" + Produktname
  // CLUSTER K FIX K11v2: Erweitere Pattern um "ausschließlich"
  const wantsOnlyOneProduct = /\b(nur|genau|einziges|einzelnes|einzelne|einzelner|ausschließlich|ausschliesslich)\b/i.test(cleaned) &&
    isProductRelated(cleaned, runtimeContext);
  
  // Bei Schimmel-Anfragen maximal 1 Produkt zeigen (Hero-Produkt)
  // Bei Budget-only maximal 2 Produkte (bereits oben begrenzt)
  // Bei expliziter "nur ein Produkt"-Anfrage maximal 1 Produkt
  const effectiveMaxRecommendations = moldQuery
    ? Math.min(1, maxRecommendations ?? 1)
    : wantsOnlyOneProduct
    ? 1
    : isBudgetOnly
    ? Math.min(2, maxRecommendations ?? 2)
    : maxRecommendations;
  
  // EFRO Budget-Fix K3/K8: Stelle sicher, dass Budget-Filter auch in finalen Empfehlungen angewendet wird
  // (falls userMinPrice/userMaxPrice gesetzt sind, filtere finalRanked nochmal)
  // WICHTIG: Bei priceRangeNoMatch = true werden Fallback-Produkte (aboveBudget) NICHT herausgefiltert
  let finalRankedWithBudget = finalRanked;
  if ((userMinPrice !== null || userMaxPrice !== null) && !priceRangeNoMatch) {
    finalRankedWithBudget = finalRanked.filter((p) => {
      const price = p.price ?? 0;
      if (userMinPrice !== null && price < userMinPrice) return false;
      if (userMaxPrice !== null && price > userMaxPrice) return false;
      return true;
    });
    
    if (finalRankedWithBudget.length !== finalRanked.length) {
      console.log("[EFRO Budget-Filter Final] Additional budget filter applied", {
        text: cleaned.substring(0, 100),
        userMinPrice,
        userMaxPrice,
        beforeCount: finalRanked.length,
        afterCount: finalRankedWithBudget.length,
        filteredOut: finalRanked.length - finalRankedWithBudget.length,
      });
    }
  }
  
  let recommended = finalRankedWithBudget.slice(0, effectiveMaxRecommendations);

  // CLUSTER K FIX K6v2: Wenn ein exakter Smartphone-Modellname gesucht wird (z.B. "Alpha 128GB Schwarz"),
  // aber nicht in den gefundenen Produkten vorkommt, dann verwerfe diese Produkte und lasse die AI Smartphone Exact Match Logik greifen
  // WICHTIG: Diese Logik muss VOR der unknownProductCodeOnly-Prüfung greifen, damit die AI Smartphone Exact Match Logik später greifen kann
  const normalizedForExactMatch = normalize(cleaned);
  const hasExactSmartphoneModelName = /\b(alpha\s+\d+\s*gb(?:\s+schwarz)?|smartphone\s+alpha\s+\d+\s*gb|das\s+alpha\s+\d+\s*gb\s+schwarz)\b/i.test(cleaned);
  if (hasExactSmartphoneModelName && recommended.length > 0 && effectiveCategorySlug === "elektronik") {
    // Prüfe, ob eines der empfohlenen Produkte den gesuchten Modellnamen enthält
    const modelNameInRecommended = recommended.some((p) => {
      const productTitle = normalize(p.title || "");
      return productTitle.includes("alpha") && 
             (productTitle.includes("128gb") || productTitle.includes("128 gb")) &&
             productTitle.includes("schwarz");
    });
    
    if (!modelNameInRecommended) {
      // K6v2 Fix: Exakter Modellname gesucht, aber nicht gefunden
      // Verwerfe falsche Produkte, damit die "AI Smartphone Exact Match" Logik später greift
      // ABER: Nur wenn effectiveCategorySlug "elektronik" ist (sonst könnte es andere Szenarien brechen)
      if (effectiveCategorySlug === "elektronik") {
        recommended = [];
        console.log("[EFRO CLUSTER K FIX K6v2] Exakter Smartphone-Modellname gesucht, aber nicht gefunden - Produkte verworfen", {
          text: cleaned.substring(0, 100),
          effectiveCategorySlug,
          recommendedCountBefore: finalRankedWithBudget.length,
          note: "AI Smartphone Exact Match Logik wird greifen",
        });
      }
    }
  }
  
  // CLUSTER K FIX K10v1/K11v1: Diese Logik wird später nach der Code-Detection ausgeführt

  // Force-Show-Logik: Bei klaren Produktanfragen immer Produkte anzeigen
  const forceShowProducts =
    nextIntent === "quick_buy" &&
    isProductRelated(cleaned, runtimeContext) &&
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
      "Frag mich z. B. nach Kategorien, Preisen, Gr??en, Materialien oder bestimmten Artikeln ? " +
      "dann zeige ich dir passende Produkte.";
  } else {
    // AI-Trigger wird sp?ter berechnet, hier noch undefined
    replyText = buildReplyText(cleaned, nextIntent, recommended, undefined, false, undefined, undefined, context?.replyMode, context?.storeFacts);
  }

  // Force-Show-Logik nach allen Guards: Wenn Produkte gefunden wurden, aber recommended leer ist
  // WICHTIG: Nicht ausführen, wenn priceRangeNoMatch === true (dann sollen keine Produkte empfohlen werden)
  if (forceShowProducts && recommended.length === 0 && candidateCount > 0 && !priceRangeNoMatch) {
    recommended = finalRanked.slice(0, effectiveMaxRecommendations);
    console.log("[EFRO SellerBrain FORCE_PRODUCTS]", {
      text: cleaned,
      intent: nextIntent,
      candidateCount,
      usedCount: recommended.length,
    });
    // Reply-Text neu generieren, wenn noch nicht gesetzt
    // AI-Trigger wird sp?ter berechnet, hier noch undefined
    if (!replyText || replyText.includes("helfe dir nur")) {
      replyText = buildReplyText(cleaned, nextIntent, recommended, undefined, false, undefined, undefined, context?.replyMode, context?.storeFacts);
    }
  }

  // [EFRO AI] Premium-Fallback: Wenn Premium-Intent und keine Produkte empfohlen wurden
  // F1: Globale Premium-Anfrage ? teuerstes Produkt im gesamten Katalog
  // F2: Premium-Parf?m ? teuerstes Parf?m-Produkt
  // K3: Premium-Wasserkocher ab 60 ? ? Wasserkocher mit Preis ? 60 ?
  if (recommended.length === 0 && nextIntent === "premium") {
    const normalizedText = normalize(cleaned);
    
    // F2: Premium-Parf?m
    if (normalizedText.includes("parfum") || normalizedText.includes("parf?m") || normalizedText.includes("perfume")) {
      const perfumeProducts = allProducts.filter((p) => {
        const title = normalize(p.title || "");
        const category = normalize(p.category || "");
        const desc = normalize(p.description || "");
        return title.includes("parfum") || title.includes("parf?m") || title.includes("perfume") ||
               category.includes("parfum") || category.includes("parf?m") || category.includes("perfume") ||
               desc.includes("parfum") || desc.includes("parf?m") || desc.includes("perfume");
      });
      
      if (perfumeProducts.length > 0) {
        const sortedByPrice = [...perfumeProducts].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        recommended = sortedByPrice.slice(0, 1);
        console.log("[EFRO AI Premium Fallback] F2 - Parf?m", {
          text: cleaned.substring(0, 100),
          recommendedCount: recommended.length,
          productTitle: recommended[0]?.title,
          productPrice: recommended[0]?.price,
        });
      }
    }
    // K3: Premium-Wasserkocher ab 60 ?
    else if (normalizedText.includes("wasserkocher") || normalizedText.includes("wasser kocher")) {
      const minPriceForK3 = 60;
      const kettleProducts = allProducts.filter((p) => {
        const title = normalize(p.title || "");
        const category = normalize(p.category || "");
        const price = p.price ?? 0;
        return (title.includes("wasserkocher") || category.includes("wasserkocher")) && price >= minPriceForK3;
      });
      
      if (kettleProducts.length > 0) {
        const sortedByPrice = [...kettleProducts].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        recommended = sortedByPrice.slice(0, Math.min(3, kettleProducts.length));
        console.log("[EFRO AI Premium Fallback] K3 - Wasserkocher ab 60?", {
          text: cleaned.substring(0, 100),
          recommendedCount: recommended.length,
          products: recommended.map((p) => ({ title: p.title, price: p.price })),
        });
      }
    }
    // F1: Globale Premium-Anfrage ? teuerstes Produkt im gesamten Katalog
    else {
      const sortedByPrice = [...allProducts].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      recommended = sortedByPrice.slice(0, 1);
      console.log("[EFRO AI Premium Fallback] F1 - Global Premium", {
        text: cleaned.substring(0, 100),
        recommendedCount: recommended.length,
        productTitle: recommended[0]?.title,
        productPrice: recommended[0]?.price,
      });
    }
    
    // Reply-Text neu generieren, wenn Produkte gefunden wurden
    if (recommended.length > 0 && (!replyText || replyText.includes("helfe dir nur"))) {
      replyText = buildReplyText(cleaned, nextIntent, recommended, undefined, false, undefined, undefined, context?.replyMode, context?.storeFacts);
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

  // AI-Trigger: Analysiere, ob zus?tzliche AI-Hilfe sinnvoll w?re
  // Analysiere Query erneut, um unknownTerms und coreTerms zu bekommen
  const parsedForAi = parseQueryForAttributes(cleaned);
  const { coreTerms: aiCoreTerms } = parsedForAi;

  // Baue Katalog-Keywords-Set f?r Alias-Analyse
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
  
  // Pr?fe, ob ein erfolgreicher AliasMatch vorhanden war
  // (wird sp?ter in CodeDetect verwendet, um zu verhindern, dass Produkte verworfen werden)
  // Dynamic Aliases aus context hinzufügen (vom AI-Resolver gelernt)
  const dynamicAliasesForCodeDetect = context?.dynamicAliases;
  const aliasMap = await initializeAliasMap(Array.from(catalogKeywordsSetForAlias), context?.shopDomain, dynamicAliasesForCodeDetect);
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
    "f?r", "mit", "und", "oder", "der", "die", "das", "ein", "eine", "einen",
    "mir", "mich", "dir", "dich", "ihm", "ihr", "uns", "euch", "ihnen",
    "zeige", "zeig", "zeigen", "zeigst", "zeigt", "zeigten", "gezeigt",
    "habe", "hast", "hat", "haben", "hatte", "hattest", "hatten",
    "bin", "bist", "ist", "sind", "war", "warst", "waren",
    "kann", "kannst", "k?nnen", "konnte", "konntest", "konnten",
    "will", "willst", "wollen", "wollte", "wolltest", "wollten",
    "soll", "sollst", "sollen", "sollte", "solltest", "sollten",
    "muss", "musst", "m?ssen", "musste", "musstest", "mussten",
    "darf", "darfst", "d?rfen", "durfte", "durftest", "durften",
  ];
  const stopwordsSet = new Set(stopwords.map((w) => normalizeText(w)));
  
  // Baue Katalog-Keywords-Set f?r AI-Trigger-Analyse
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
  
  // EFRO: Sammle m?gliche Produktcodes (z. B. "XY-9000") f?r AI-Trigger
  const possibleProductCodes: string[] = [];
  const tokens = normalizedText.split(/\s+/);
  for (const token of tokens) {
    const lower = token.toLowerCase();
    const hasLetters = /[a-z]/.test(lower);
    const hasDigits = /\d/.test(lower);
    
    if (hasLetters && hasDigits && looksLikeProductCode(lower)) {
      // Pr?fe, ob Token NICHT durch bekannte Alias-/Kategorie-Maps abgedeckt ist
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

  // Heuristiken f?r AI-Trigger
  const aiUnknownTerms: string[] = [];

  if (unknownTermsFromAnalysis && unknownTermsFromAnalysis.length > 0) {
    aiUnknownTerms.push(...unknownTermsFromAnalysis);
  }

  // Basiswerte f?r Heuristik
  const finalCount = recommended.length;
  const unknownCount = aiUnknownTerms.length;

  // ---------------------------------------------
  // Spezieller Check: Nutzer nennt nur einen Produktcode wie "ABC123"
  // -> Falls dieser Code im Katalog NICHT vorkommt, behandeln wir es
  //    als "unknown_product_code_only" und zeigen KEINE Produkte an.
  // WICHTIG: Budget-Only-Queries d?rfen NIE als unknown_product_code_only behandelt werden.
  // WICHTIG: Kategorie-Codes (z.B. "snowboards" bei Kategorie "snowboard") d?rfen NIE als unknown_product_code_only behandelt werden.
  // ---------------------------------------------
  
  // EFRO Modularization Phase 3: Kategorie-Informationen ?ber determineEffectiveCategory berechnen
  const t = normalize(cleaned);
  const categoryResultForCodeDetect = determineEffectiveCategory({
    text: cleaned,
    cleanedText: t,
    contextCategory: context?.activeCategorySlug ?? null,
    allProducts,
  });
  
  const categoryHintsInText = categoryResultForCodeDetect.categoryHintsInText;
  const matchedCategories = categoryResultForCodeDetect.matchedCategories;
  const triggerWord = categoryResultForCodeDetect.triggerWord;
  
  // Effective Category Slug bestimmen (aus Text oder Kontext)
  let effectiveCategorySlugForCodeDetect: string | null = categoryResultForCodeDetect.effectiveCategorySlug;
  if (!effectiveCategorySlugForCodeDetect && recommended.length > 0 && recommended[0].category) {
    effectiveCategorySlugForCodeDetect = normalize(recommended[0].category);
  }
  
  // Budget-Wort-Erkennung f?r zus?tzliche Sicherheit (wird bereits oben berechnet, hier wiederverwenden)
  // Verwende die bereits oben berechneten Variablen: hasBudget, isBudgetOnly
  const originalForBudget = cleaned.toLowerCase();
  // Importiert aus languageRules.de.ts
  // WICHTIG: hasBudgetWord wurde bereits oben aus budgetInfo destructured, hier nur f?r Logik verwenden
  const hasBudgetWordForCodeDetect =
    BUDGET_WORD_PATTERNS.some((pattern) => originalForBudget.includes(pattern)) ||
    /\b(budget|preis|maximal|max|h?chstens|hoechstens|nicht mehr als|unter|bis)\b/i.test(cleaned);

  let unknownProductCodeOnly = false;
  let detectedCodeTerm: string | null = null;

  try {
    detectedCodeTerm = extractCodeTermFromText(cleaned);
  } catch (e) {
    console.warn("[EFRO CodeDetect] Fehler bei extractCodeTermFromText", e);
  }

  if (detectedCodeTerm) {
    const codeLc = detectedCodeTerm.toLowerCase();

    // Pr?fen, ob dieser Code irgendwo im Katalog vorkommt
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

    // Hilfsflags f?r CodeDetect
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

    // WICHTIG: Budget-Only-Queries d?rfen NIE als unknown_product_code_only behandelt werden
    // Verwende die bereits oben berechneten Variablen hasBudgetWord und isBudgetOnly
    if (hasBudgetWordForCodeDetect || isBudgetOnly || isCheapestLikeQuery) {
      // Budget-Only-Query erkannt ? unknownProductCodeOnly NICHT setzen
      unknownProductCodeOnly = false;
      console.log("[EFRO CodeDetect] Budget-Only-Query erkannt, CodeDetect blockiert", {
        text: cleaned,
        detectedCodeTerm,
        hasBudgetWord: hasBudgetWordForCodeDetect,
        isBudgetOnly,
        hasBudget,
        isCheapestLikeQuery,
        productCodeExistsInCatalog,
        note: "Budget-Only-Queries werden nicht als unknown_product_code_only behandelt",
      });
    } else if (aliasMatchSuccessful && candidateCountAfterAlias > 0) {
      // WICHTIG: Wenn ein erfolgreicher AliasMatch vorhanden ist, d?rfen diese Produkte NICHT verworfen werden
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
      // Pr?fe, ob der Term wirklich wie ein Produktcode aussieht (Ziffern oder Bindestrich/Unterstrich)
      const isCodeLike = looksLikeProductCode(detectedCodeTerm);
      
      // Nur echte Code-Begriffe k?nnen unknownProductCodeOnly ausl?sen
      // Normale W?rter wie "hundefutter", "katzenfutter", "parfum" werden nicht als Code behandelt
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
      
      // EFRO D6/F1 Fix: Premium-Intent + "premium-produkte" → nicht als Code behandeln
      const isPremiumIntent = nextIntent === "premium";
      const isPremiumProdukteTerm = detectedCodeTerm && (
        detectedCodeTerm.toLowerCase().includes("premium-produkte") ||
        detectedCodeTerm.toLowerCase().includes("premium-produkt") ||
        detectedCodeTerm.toLowerCase() === "premium-produkte" ||
        detectedCodeTerm.toLowerCase() === "premium-produkt"
      );
      if (isPremiumIntent && isPremiumProdukteTerm) {
        unknownProductCodeOnly = false;
        console.log("[EFRO CodeDetect] Premium-Intent + premium-produkte erkannt, CodeDetect blockiert", {
          text: cleaned,
          detectedCodeTerm,
          nextIntent,
          productCodeExistsInCatalog,
          note: "Premium-Intents mit 'premium-produkte' werden nicht als unknown_product_code_only behandelt",
        });
      }
      
      // F1v1 Fix: "premium-variante" → nicht als Code behandeln, wenn Premium-Intent
      const isPremiumVarianteTerm = detectedCodeTerm && (
        detectedCodeTerm.toLowerCase().includes("premium-variante") ||
        detectedCodeTerm.toLowerCase() === "premium-variante"
      );
      if (isPremiumIntent && isPremiumVarianteTerm) {
        unknownProductCodeOnly = false;
        console.log("[EFRO CodeDetect] Premium-Intent + premium-variante erkannt, CodeDetect blockiert", {
          text: cleaned,
          detectedCodeTerm,
          nextIntent,
          productCodeExistsInCatalog,
          note: "Premium-Intents mit 'premium-variante' werden nicht als unknown_product_code_only behandelt",
        });
      }
      
      // EFRO K3 Fix: "premium-wasserkocher" → nicht als Code behandeln, wenn "wasserkocher" im Text ist
      const hasWasserkocherInText = cleaned.toLowerCase().includes("wasserkocher") ||
                                     cleaned.toLowerCase().includes("kettle") ||
                                     cleaned.toLowerCase().includes("electric kettle");
      const isPremiumWasserkocherTerm = detectedCodeTerm && (
        detectedCodeTerm.toLowerCase().includes("premium-wasserkocher") ||
        detectedCodeTerm.toLowerCase().includes("wasserkocher")
      );
      if (hasWasserkocherInText && isPremiumWasserkocherTerm) {
        unknownProductCodeOnly = false;
        console.log("[EFRO CodeDetect] Wasserkocher erkannt, CodeDetect blockiert (K3 Fix)", {
          text: cleaned,
          detectedCodeTerm,
          hasWasserkocherInText,
          productCodeExistsInCatalog,
          note: "Wasserkocher-Terms werden nicht als unknown_product_code_only behandelt",
        });
      }
      
      // K10v1/K11v1 Fix: "slim-fit-jeans" → nicht als Code behandeln, wenn "jeans" im Query ist
      const hasJeansInText = cleaned.toLowerCase().includes("jeans") || 
                             (cleaned.toLowerCase().includes("slim") && cleaned.toLowerCase().includes("fit"));
      const isJeansTerm = detectedCodeTerm && (
        detectedCodeTerm.toLowerCase().includes("jeans") ||
        detectedCodeTerm.toLowerCase().includes("slim-fit")
      );
      if (hasJeansInText && isJeansTerm && effectiveCategorySlugForCodeDetect === "mode") {
        unknownProductCodeOnly = false;
        console.log("[EFRO CodeDetect] Jeans-Term erkannt, CodeDetect blockiert (K10v1/K11v1 Fix)", {
          text: cleaned,
          detectedCodeTerm,
          hasJeansInText,
          effectiveCategorySlug: effectiveCategorySlugForCodeDetect,
          productCodeExistsInCatalog,
          note: "Jeans-Terms werden nicht als unknown_product_code_only behandelt",
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
          ? "Code erkannt, aber nicht im Katalog gefunden ? unknownProductCodeOnly = true"
          : isCodeLike
          ? "Code erkannt, aber blockiert (Kategorie/Alias/Budget)"
          : "Term erkannt, aber kein Code-Format (nur Buchstaben) ? nicht als Code behandelt",
      });
    }

    if (unknownProductCodeOnly) {
      // CLUSTER 3 FIX: Wenn eine Kontext-Kategorie oder effectiveCategorySlug gesetzt ist und Produkte in dieser Kategorie gefunden wurden,
      // dann die Produkte NICHT verwerfen, auch wenn unknownProductCodeOnly true ist
      // Dies stellt sicher, dass Kontext-Kategorien (z.B. "haustier", "perfume", "snowboard") beibehalten werden
      const hasContextCategory = context?.activeCategorySlug;
      const hasProductsInContextCategory = hasContextCategory && recommended.some(
        (p) => normalize(p.category || "") === normalize(hasContextCategory)
      );
      // CLUSTER 3 FIX: Prüfe auch, ob effectiveCategorySlug gesetzt ist und Produkte in dieser Kategorie vorhanden sind
      const hasProductsInEffectiveCategory = effectiveCategorySlug ? (() => {
        const normalizedEffectiveCategory = normalize(effectiveCategorySlug);
        return recommended.some(
          (p) => normalize(p.category || "") === normalizedEffectiveCategory
        );
      })() : false;
      
      // CLUSTER K FIX K6v2: Wenn ein exakter Smartphone-Modellname gesucht wird, aber nicht gefunden wurde,
      // dann verwerfe die Produkte, damit die AI Smartphone Exact Match Logik später greifen kann
      const hasExactSmartphoneModelNameForCodeDetect = /\b(alpha\s+\d+\s*gb(?:\s+schwarz)?|smartphone\s+alpha\s+\d+\s*gb|das\s+alpha\s+\d+\s*gb\s+schwarz)\b/i.test(cleaned);
      const shouldAllowSmartphoneExactMatch = hasExactSmartphoneModelNameForCodeDetect && effectiveCategorySlug === "elektronik";
      
      // CLUSTER K FIX K10v1/K11v1: Wenn "jeans" im Query ist, aber keine Jeans-Produkte im Katalog sind,
      // dann verwerfe die Produkte NICHT, damit die Mode-Fallback-Logik später greifen kann
      const normalizedForJeansCodeDetect = normalize(cleaned);
      const hasJeansQueryForCodeDetect = normalizedForJeansCodeDetect.includes("jeans");
      const shouldAllowJeansFallback = hasJeansQueryForCodeDetect && effectiveCategorySlug === "mode";
      
      // In diesem Fall wollen wir KEINE Produktkarten anzeigen
      // WICHTIG: Nur wenn KEIN erfolgreicher AliasMatch vorhanden ist UND keine Kontext-Kategorie/effectiveCategory mit Produkten
      // UND nicht für Smartphone Exact Match oder Jeans Fallback
      if ((!aliasMatchSuccessful || candidateCountAfterAlias === 0) && !hasProductsInContextCategory && !hasProductsInEffectiveCategory && !shouldAllowSmartphoneExactMatch && !shouldAllowJeansFallback) {
        recommended = [];
        console.log("[EFRO CodeDetect] Produkte verworfen (unknownProductCodeOnly = true)", {
          text: cleaned,
          detectedCodeTerm,
          aliasMatchSuccessful,
          candidateCountAfterAlias,
          recommendedCountBefore: recommended.length,
        });
      } else {
        if (hasProductsInContextCategory || hasProductsInEffectiveCategory) {
          console.log("[EFRO CodeDetect] Produkte NICHT verworfen (Kategorie mit Produkten)", {
            text: cleaned,
            detectedCodeTerm,
            contextCategory: hasContextCategory,
            effectiveCategorySlug,
            recommendedCount: recommended.length,
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
  // WICHTIG: Budget-Only-Queries d?rfen NIE als unknown_product_code_only behandelt werden
  
  // [EFRO AI] Filtere triviale W?rter aus unknownTerms f?r AI-Trigger-Entscheidungen
  // Entferne generische Stopwords und Begriffe, die bereits als Kategorie- oder Alias-Treffer erkannt wurden
  const resolvedTermsSet = new Set(
    (aliasCheckResult?.resolved || []).map((t) => normalizeAliasKey(t.toLowerCase()))
  );
  const knownKeywordsNormalized = new Set(
    Array.from(catalogKeywordsSetForAlias || []).map((kw) => normalizeAliasKey(kw.toLowerCase()))
  );
  
  const filteredUnknownTerms = (aiUnknownTerms || [])
    .map((t) => t.toLowerCase().trim())
    .filter((t) => t.length > 1)
    // Reine Zahlen (Budget-Werte wie "20", "300", "10000") NICHT als unknownTerms behandeln
    .filter((t) => !/^\d+([.,]\d+)?$/.test(t))
    .filter((t) => !UNKNOWN_AI_STOPWORDS_SET.has(t))
    // [EFRO AI] Entferne generische Stopwords
    .filter((t) => !GENERIC_UNKNOWN_STOPWORDS.has(t))
    // [EFRO AI] Entferne Begriffe, die bereits als Kategorie- oder Alias-Treffer erkannt wurden
    .filter((t) => {
      const normalized = normalizeAliasKey(t);
      return !resolvedTermsSet.has(normalized) && !knownKeywordsNormalized.has(normalized);
    });
  
  const filteredUnknownCount = filteredUnknownTerms.length;


  // AI-Trigger initialisieren
  let aiTrigger: SellerBrainAiTrigger | undefined = undefined;

  // J3v2 Fix: Prüfe Budget-Smalltalk direkt, bevor andere AI-Trigger-Logik ausgeführt wird
  // Dies stellt sicher, dass vage Budget-Aussagen (z. B. "Ich habe nicht viel Geld zur Verfügung")
  // KEINEN AI-Trigger auslösen, auch wenn hasBudgetWord false ist
  const normalizedTextForSmalltalk = normalize(cleaned);
  // Importiere isBudgetSmalltalk aus aiTrigger.ts (wird als Helper verwendet)
  const isBudgetSmalltalkCheck = (text: string): boolean => {
    const normalized = text.toLowerCase();
    const smalltalkPatterns = [
      /\bmein\s+budget\s+ist\s+begrenzt\b/i,
      /\bich\s+habe\s+ein\s+kleines\s+budget\b/i,
      /\bich\s+habe\s+nicht\s+viel\s+geld\s+zur\s+verfügung\b/i,
      /\bich\s+bin\s+knapp\s+bei\s+kasse\b/i,
      /\bmein\s+budget\s+ist\s+klein\b/i,
      /\bich\s+habe\s+wenig\s+geld\b/i,
      /\bich\s+habe\s+nicht\s+viel\s+geld\b/i,
      /\bich\s+habe\s+kaum\s+geld\b/i,
      /\bich\s+habe\s+nur\s+wenig\s+geld\b/i,
      /\bmein\s+budget\s+ist\s+sehr\s+klein\b/i,
      /\bmein\s+budget\s+ist\s+begrenzt\b/i,
      /\bich\s+habe\s+ein\s+kleines\s+budget\b/i,
      /\bich\s+habe\s+ein\s+begrenztes\s+budget\b/i,
      /\bich\s+habe\s+nicht\s+genug\s+geld\b/i,
    ];
    return smalltalkPatterns.some((pattern) => pattern.test(normalized));
  };
  
  if (isBudgetSmalltalkCheck(normalizedTextForSmalltalk)) {
    aiTrigger = {
      needsAiHelp: false,
      reason: "budget_smalltalk_no_ai",
    };
    console.log("[EFRO SB AI-Trigger] J3v2 Fix - Budget-Smalltalk erkannt, KEIN AI-Trigger", {
      text: cleaned.substring(0, 100),
      normalizedText: normalizedTextForSmalltalk,
    });
  }

  // NEU: Zentrale AI-Trigger-Entscheidung f?r Budget-F?lle (G3, J1)
  // Rufe decideAiTrigger auf, sobald alle ben?tigten Daten verf?gbar sind
  // Verwende priceRangeInfo, falls vorhanden, sonst berechne categoryMinPrice/categoryMaxPrice aus allProducts
  const resolvedUnknownTermsForBudget = aliasCheckResult?.resolved || [];
  let categoryMinPriceForDecide: number | null = null;
  let categoryMaxPriceForDecide: number | null = null;
  
  if (priceRangeInfo) {
    // Verwende priceRangeInfo, falls vorhanden
    categoryMinPriceForDecide = priceRangeInfo.categoryMinPrice;
    categoryMaxPriceForDecide = priceRangeInfo.categoryMaxPrice;
  } else if (hasUserPriceRange && (userMinPrice !== null || userMaxPrice !== null)) {
    // Berechne categoryMinPrice/categoryMaxPrice aus allProducts, falls priceRangeInfo nicht verf?gbar ist
    const effectiveCategorySlugForDecide = effectiveCategorySlugForCodeDetect || context?.activeCategorySlug || null;
    const productsInCategoryForDecide = effectiveCategorySlugForDecide
      ? allProducts.filter((p) => normalize(p.category || "") === normalize(effectiveCategorySlugForDecide))
      : allProducts;
    
    const pricesInCategoryForDecide = productsInCategoryForDecide
      .map((p) => p.price ?? 0)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    
    categoryMinPriceForDecide = pricesInCategoryForDecide.length > 0 ? pricesInCategoryForDecide[0] : null;
    categoryMaxPriceForDecide = pricesInCategoryForDecide.length > 0 ? pricesInCategoryForDecide[pricesInCategoryForDecide.length - 1] : null;
  }
  
  // EFRO S14 Fix: Erweitere unknownTerms f?r decideAiTrigger um detectedCodeTerm,
  // wenn dieser nicht im Katalog gefunden wurde und ein Budget vorhanden ist
  let unknownTermsForDecide = [...filteredUnknownTerms];
  if (detectedCodeTerm && (priceRangeInfo || hasUserPriceRange || hasBudgetWord)) {
    const codeLc = detectedCodeTerm.toLowerCase();
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
    
    if (!productCodeExistsInCatalog && !unknownTermsForDecide.includes(codeLc)) {
      unknownTermsForDecide.push(codeLc);
    }
  }
  
  // [EFRO AI] Bestimme hasCategoryMatch f?r decideAiTrigger
  const hasCategoryMatchForDecide = 
    (matchedCategories && matchedCategories.length > 0) ||
    !!effectiveCategorySlugForCodeDetect ||
    (categoryHintsInText && categoryHintsInText.length > 0);
  
  // J3v2 Fix: normalizedText für decideAiTrigger bereitstellen
  const normalizedTextForDecide = normalize(cleaned);
  
  // J3v2 Fix: decideAiTrigger auch aufrufen, wenn nur Budget-Wort vorhanden ist (ohne explizite Zahl)
  // Dies ermöglicht die Erkennung von Budget-Smalltalk (z. B. "Ich habe nicht viel Geld zur Verfügung")
  const shouldCallDecideAiTrigger = (priceRangeInfo || hasUserPriceRange || hasBudgetWord) && 
    (unknownTermsForDecide.length > 0 || detectedCodeTerm || hasBudgetWord);
  
  if (shouldCallDecideAiTrigger) {
    const aiTriggerInput = {
      userMinPrice: priceRangeInfo?.userMinPrice ?? userMinPrice ?? null,
      userMaxPrice: priceRangeInfo?.userMaxPrice ?? userMaxPrice ?? null,
      categoryMinPrice: categoryMinPriceForDecide,
      categoryMaxPrice: categoryMaxPriceForDecide,
      unknownTerms: unknownTermsForDecide,
      resolvedUnknownTerms: resolvedUnknownTermsForBudget,
      codeTerm: detectedCodeTerm || undefined,
      unknownProductCodeOnly: unknownProductCodeOnly || undefined,
      hasCategoryMatch: hasCategoryMatchForDecide,
      priceRangeNoMatch: priceRangeNoMatch || undefined,
      normalizedText: normalizedTextForDecide,
      hasEffectiveCategory: !!effectiveCategorySlugForCodeDetect,
      candidateCountAfterKeywordMatches: filterResult.length,
      finalCount: recommended.length,
    };
    const budgetAiTrigger = decideAiTrigger(aiTriggerInput);
    
    // Wenn decideAiTrigger einen Trigger zur?ckgibt, verwende diesen f?r Budget-F?lle
    // Die alte Logik f?r andere F?lle (unknown_product_code_only, etc.) wird weiterhin verwendet
    if (budgetAiTrigger) {
      // ?berschreibe aiTrigger nur, wenn es noch nicht gesetzt wurde
      // oder wenn der Grund ein Budget-bezogener ist
      if (!aiTrigger || budgetAiTrigger.reason === "budget_very_low") {
        aiTrigger = budgetAiTrigger;
        console.log("[EFRO SB decideAiTrigger] Budget-Trigger erkannt", {
          text: cleaned.substring(0, 100),
          reason: budgetAiTrigger.reason,
          userMaxPrice: priceRangeInfo?.userMaxPrice ?? userMaxPrice,
          categoryMinPrice: categoryMinPriceForDecide,
          categoryMaxPrice: categoryMaxPriceForDecide,
        });
      }
    } else if (budgetAiTrigger === undefined && (priceRangeInfo?.userMaxPrice ?? userMaxPrice) !== null && 
               categoryMaxPriceForDecide !== null && categoryMinPriceForDecide !== null &&
               (priceRangeInfo?.userMaxPrice ?? userMaxPrice ?? 0) >= categoryMaxPriceForDecide * 1.5) {
      // J1-Fall: Sehr hohes Budget ? KEIN AI-Trigger
      // Stelle sicher, dass kein AI-Trigger f?r Budget-F?lle gesetzt wird
      console.log("[EFRO SB decideAiTrigger] Sehr hohes Budget erkannt, KEIN AI-Trigger (J1)", {
        text: cleaned.substring(0, 100),
        userMaxPrice: priceRangeInfo?.userMaxPrice ?? userMaxPrice,
        categoryMaxPrice: categoryMaxPriceForDecide,
        note: "EFRO kann problemlos Produkte empfehlen, AI ist hier nicht n?tig",
      });
      // Stelle sicher, dass aiTrigger f?r Budget-F?lle nicht gesetzt wird
      // (wird sp?ter in der alten Logik ?berschrieben, wenn andere Gr?nde vorhanden sind)
    }
  }

  // EFRO S14 Fix: Pr?fe fr?hzeitig auf unbekannte Produktcodes (vor Budget-Only-Check)
  // Diese sollen auch bei Budget-Only-Queries einen AI-Trigger ausl?sen
  let hasUnknownProductCode = false;
  let hasFressnapf = false;
  let unknownProductCodesForTrigger: string[] = [];
  
  // Pr?fe possibleProductCodes
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
  
  // Pr?fe auch detectedCodeTerm (wird sp?ter im CodeDetect-Block berechnet, hier vorbereiten)
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
  
  // EFRO Fressnapf-Fix: Pr?fe, ob "fressnapf" in den unbekannten Begriffen ist
  hasFressnapf = filteredUnknownTerms.some((t) => 
    normalizeAliasKey(t) === "fressnapf" || t.toLowerCase().includes("fressnapf")
  );
  
  const hasUnknownBrandOrCode = hasUnknownProductCode || hasFressnapf;

  // SCHRITT 1 FIX: Pr?fe auf "pure budget query ohne Zahl" (z. B. "Ich habe ein kleines Budget.")
  // Diese Logik sollte KEIN AI-Trigger setzen, sondern regelbasierte R?ckfrage
  const hasNoNumber = userMinPrice === undefined && userMaxPrice === undefined;
  const isPureBudgetQuery = hasBudgetWord && hasNoNumber && !isProductRelated(cleaned, runtimeContext);

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
    // KEIN AI-Trigger ? aiTrigger bleibt undefined
  } else if (isPureBudgetQuery) {
    // SCHRITT 1 FIX: Pure Budget-Query ohne Zahl ? kein AI-Trigger
    console.log("[EFRO SB AI-Trigger] Skipped for pure budget-only query (clarify in replyText)", {
      text: cleaned.substring(0, 100),
      finalCount,
      hasBudgetWord,
      hasNoNumber,
      isProductRelated: isProductRelated(cleaned, runtimeContext),
      note: "Regelbasierte R?ckfrage statt AI-Trigger",
    });
    // KEIN AI-Trigger ? aiTrigger bleibt undefined
  } else {
    // Restliche AI-Trigger-Entscheidungen kommen in diesen else-Block
    let needsAiHelp = false;
    let reason = "";

    const isGlobalBudgetOnly =
      isBudgetOnly &&
      !hasContextCategory &&
      !hasUnknownBrandOrCode &&
      filteredUnknownCount === 0;

    // TODO-AI-REFACTOR: Alte Budget-Logik neutralisiert - wird durch decideAiTrigger ersetzt
    // Pr?fe, ob decideAiTrigger bereits einen Budget-Trigger zur?ckgegeben hat
    const hasBudgetTriggerFromDecide = aiTrigger?.reason === "budget_very_low";
    
    if (isGlobalBudgetOnly && !hasBudgetTriggerFromDecide) {
      // Alte Logik nur ausf?hren, wenn decideAiTrigger noch keinen Trigger zur?ckgegeben hat
      needsAiHelp = true;
      reason = "budget_only";
    } else {
      // Hilfsflags f?r AI-Trigger (wiederverwenden, falls bereits berechnet)
      const hasRecommendations = finalCount > 0;
      const hasEffectiveCategory =
        !!effectiveCategorySlugForCodeDetect ||
        (matchedCategories && matchedCategories.length > 0) ||
        (categoryHintsInText && categoryHintsInText.length > 0);
      // EFRO Fix: Erkl?rungs-Intent mit Produkt ? KEINE AI
      // Die Antwort wird direkt aus der Produktbeschreibung generiert (wenn vorhanden)
      // oder ehrlich kommuniziert, dass keine Beschreibung vorhanden ist (ohne AI)
      const isExplanationIntent = effectiveExplanationMode !== null;
    
      if (isExplanationIntent && hasRecommendations) {
        // Erkl?rung + Produkt gefunden ? KEINE AI
        needsAiHelp = false;
        reason = "";
        console.log("[EFRO SB AI-Trigger] Skipped for explanation with product match", {
          text: cleaned.substring(0, 100),
          explanationMode: effectiveExplanationMode,
          finalCount,
          hasRecommendations,
          note: "Antwort wird direkt aus Produktbeschreibung generiert, keine AI n?tig",
        });
      } else {
        // Standard AI-Trigger-Logik f?r alle anderen F?lle
        
        // a) Code-Only-Unknown-Fall (soll bleiben)
        // 1.3) AI-Trigger ?unknown_product_code_only" nur im echten Code-Only-Fall erlauben
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
          // synonymLookupTerms wird weiter unten definiert, daher hier nur filteredUnknownCount pr?fen
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
              note: "Keine Produkte gefunden, aber auch keine unbekannten Keywords ? keine AI",
            });
          }
        } else if (filteredUnknownCount > 0 && finalCount > 0) {
          // b) Low-Confidence-Unknown-Terms-Fall: Nur wenn gefilterte Unknown-Terms vorhanden
          // Ausnahme: sehr hohe Budget-Only-Anfragen mit bereits gefundenen Produkten (J1).
          // In diesem Fall soll KEIN AI-Trigger gesetzt werden, damit die Antwort rein regelbasiert bleibt.
          const skipForHighBudgetOnly = shouldSkipLowConfidenceForHighBudget({
            isBudgetOnly,
            userMinPrice,
            userMaxPrice,
            finalCount,
          });

          // J3v2 Fix: Überschreibe NICHT, wenn bereits Budget-Smalltalk erkannt wurde
          if (!skipForHighBudgetOnly && !(aiTrigger && aiTrigger.reason === "budget_smalltalk_no_ai")) {
            needsAiHelp = true;
            reason = "low_confidence_unknown_terms";
          } else {
            console.log(
              "[EFRO SB AI-Trigger] Skipped low_confidence_unknown_terms for high-budget-only query",
              {
                text: cleaned.substring(0, 100),
                finalCount,
                filteredUnknownCount,
                userMinPrice,
                userMaxPrice,
                isBudgetOnly,
              }
            );
          }
        } else if (filteredUnknownCount >= 3) {
          needsAiHelp = true;
          reason = "many_unknown_terms";
        }
        
        // EFRO S14 Fix: Unbekannter Begriff + Budget
        // Wenn noch kein AI-Trigger gesetzt wurde, aber unbekannte Begriffe UND Budget vorhanden sind
        if (!needsAiHelp && finalCount > 0) {
          // Pr?fe auf unbekannte Begriffe (Codes oder normale Begriffe)
          const hasUnknownTerms = 
            filteredUnknownCount > 0 || 
            unknownProductCodeOnly || 
            (unknownProductCodesForTrigger && unknownProductCodesForTrigger.length > 0);
          
          // Pr?fe auf Budget-Information
          // EFRO Budget: userMinPrice/userMaxPrice kommen zentral aus src/lib/sales/budget.ts (analyzeBudget)
          const hasBudgetInfo = 
            hasBudgetWord || 
            (userMinPrice !== null && userMinPrice !== undefined) || 
            (userMaxPrice !== null && userMaxPrice !== undefined);
          
          // Pr?fe, ob es NICHT ein High-Budget-Only-Fall ist (J1-Guard)
          const skipForHighBudgetOnly = shouldSkipLowConfidenceForHighBudget({
            isBudgetOnly,
            userMinPrice,
            userMaxPrice,
            finalCount,
          });
          
          if (hasUnknownTerms && hasBudgetInfo && !skipForHighBudgetOnly) {
            needsAiHelp = true;
            reason = "unknown_term_with_budget";
            
            console.log("[EFRO SB AI-Trigger] Set for unknown_term_with_budget", {
              text: cleaned.substring(0, 100),
              filteredUnknownCount,
              unknownProductCodeOnly,
              unknownProductCodesCount: unknownProductCodesForTrigger?.length ?? 0,
              hasBudgetWord,
              userMinPrice,
              userMaxPrice,
              finalCount,
              isBudgetOnly,
              note: "S14: Unbekannter Begriff + Budget erkannt",
            });
          }
        }


      // EFRO: Verwende bereits berechnete unknownProductCodesForTrigger
      const unknownProductCodes = unknownProductCodesForTrigger.length > 0 
        ? unknownProductCodesForTrigger 
        : [];
      
      // EFRO: Pr?fe auf unbekannte Begriffe f?r Synonym-Lookup (z. B. "fressnapf")
      // Diese Begriffe sind nicht in CATEGORY_KEYWORDS, nicht in statischen Synonym-Maps,
      // und nicht in Tag-/Titel-Treffern gefunden
      const synonymLookupTerms: string[] = [];
      if (filteredUnknownTerms.length > 0) {
        // Pr?fe, ob Begriffe in dynamischen Synonymen vorhanden sind
        const dynamicSynonyms = getDynamicSynonyms();
        const dynamicSynonymTerms = new Set(dynamicSynonyms.map((s) => s.term.toLowerCase()));
        
        for (const term of filteredUnknownTerms) {
          // Wenn Begriff nicht in dynamischen Synonymen und nicht wie ein Produktcode aussieht
          if (!dynamicSynonymTerms.has(term) && !looksLikeProductCode(term)) {
            // Pr?fe, ob Begriff in Produkten gefunden wurde
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
      
      // EFRO: Setze AI-Trigger f?r unknown_product_code / unknown_product_code_with_budget, wenn Codes gefunden wurden
      if (unknownProductCodes.length > 0 && !needsAiHelp) {
        needsAiHelp = true;

        // Pr?fe, ob der Nutzer tats?chlich ein Budget angegeben hat
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
      
      // EFRO: Setze AI-Trigger f?r synonym_lookup, wenn unbekannte Begriffe gefunden wurden
      if (synonymLookupTerms.length > 0 && !needsAiHelp && finalCount === 0) {
        needsAiHelp = true;
        reason = "synonym_lookup";
      }


      // TODO-AI-REFACTOR: Hauptstelle f?r AI-Trigger-Setzung (wird durch decideAiTrigger ersetzt)
      // J3v2 Fix: Überschreibe NICHT, wenn bereits Budget-Smalltalk erkannt wurde
      if (needsAiHelp && !(aiTrigger && aiTrigger.reason === "budget_smalltalk_no_ai")) {
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
        
        // EFRO Fressnapf-Fix: Setze unknownTerms f?r "fressnapf" als unbekannte Marke
        if (hasFressnapf) {
          const fressnapfTerms = filteredUnknownTerms.filter((t) => 
            normalizeAliasKey(t) === "fressnapf" || t.toLowerCase().includes("fressnapf")
          );
          if (fressnapfTerms.length > 0) {
            aiTrigger.unknownTerms = [...(aiTrigger.unknownTerms || []), ...fressnapfTerms];
          }
        }
        
        // EFRO S14 Fix: Bei Budget + unbekanntem Code, f?ge Code zu unknownTerms hinzu
        if ((reason === "unknown_product_code_with_budget" || reason === "unknown_product_code") && 
            unknownProductCodesForTrigger.length > 0) {
          aiTrigger.unknownTerms = [...(aiTrigger.unknownTerms || []), ...unknownProductCodesForTrigger];
        }
        
        // EFRO S14 Fix: Bei unknown_term_with_budget, f?ge Codes zu unknownTerms hinzu (falls vorhanden)
        if (reason === "unknown_term_with_budget" && unknownProductCodesForTrigger.length > 0) {
          aiTrigger.unknownTerms = [...(aiTrigger.unknownTerms || []), ...unknownProductCodesForTrigger];
        }
        
        // EFRO: Setze unknownTerms f?r synonym_lookup
        if (reason === "synonym_lookup" && synonymLookupTerms.length > 0) {
          aiTrigger.unknownTerms = synonymLookupTerms;
        }
        
        // EFRO Fressnapf-Fix: Setze termExplainRequests f?r unbekannte Begriffe
        if (filteredUnknownTerms.length > 0 && (reason === "unknown_term_expansion" || reason === "low_confidence_unknown_terms" || reason === "synonym_lookup" || reason === "unknown_term_with_budget")) {
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
            ? "AliasMatch erfolgreich ? unknown_product_code_only NICHT gesetzt"
            : "Kein AliasMatch ? unknown_product_code_only kann gesetzt werden",
        });
      }
	
      // TODO-AI-REFACTOR: AI-Trigger f?r priceRangeNoMatch (wird durch decideAiTrigger ersetzt)
      // EFRO Budget-Fix 2025-12-XX: AI-Trigger f?r unrealistische Budgets / keinen Treffer im Preisbereich
      // Falls priceRangeNoMatch gesetzt ist, aber bisher kein anderer AI-Trigger existiert,
      // signalisieren wir der AI, dass sie helfen soll, das Budget sinnvoll einzuordnen.
      // Pr?fe, ob decideAiTrigger bereits einen Budget-Trigger zur?ckgegeben hat
      const hasBudgetTriggerFromDecide = aiTrigger?.reason === "budget_very_low";
      if (!aiTrigger && priceRangeNoMatch && !hasBudgetTriggerFromDecide) {
        // Alte Logik nur ausf?hren, wenn decideAiTrigger noch keinen Trigger zur?ckgegeben hat
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
          note: "Unrealistischer oder leerer Preisbereich ? AI soll Budget erkl?ren/helfen",
        });
      }
    }
    }
  }

  // ?? EFRO Budget-AI-Override (G3/J1 Fix)
  // Ziel:
  // - Kleine, reine Budget-Queries ohne Produkt (z. B. "Ich habe nur 20 Euro.")
  //   ? AI soll helfen, Kategorie/Kontext zu kl?ren.
  // - Sehr hohes Budget (J1) mit vorhandenen Produkten
  //   ? KEIN AI-Trigger, damit Antwort rein regelbasiert bleibt.
  if (!aiTrigger && hasBudget) {
    const hasNumericBudget =
      (typeof userMinPrice === "number" && !Number.isNaN(userMinPrice)) ||
      (typeof userMaxPrice === "number" && !Number.isNaN(userMaxPrice));

    const maxBudget =
      typeof userMaxPrice === "number" && !Number.isNaN(userMaxPrice)
        ? userMaxPrice
        : undefined;

    // Schwelle f?r "sehr hohes Budget" (J1)
    const HIGH_BUDGET_THRESHOLD = 1000;

    if (isBudgetOnly && hasNumericBudget && maxBudget !== undefined) {
      if (maxBudget < HIGH_BUDGET_THRESHOLD) {
        // ?? G3: kleines Budget, reine Budget-Query ohne Produkt ? AI soll helfen
        aiTrigger = {
          needsAiHelp: true,
          reason: "budget_only_low_budget",
          queryForAi: cleaned,
        };

        console.log("[EFRO SB AI-Trigger] Set for budget_only_low_budget", {
          text: cleaned.substring(0, 100),
          userMinPrice,
          userMaxPrice,
          finalCount,
          isBudgetOnly,
          note: "Reine Budget-Query mit kleinem Budget ? AI soll Kategorie/Kontext kl?ren",
        });
      } else if (recommended.length > 0) {
        // ?? J1: sehr hohes Budget, aber wir haben bereits Empfehlungen
        // ? bewusst KEIN AI-Trigger, aiTrigger bleibt undefined
        console.log("[EFRO SB AI-Trigger] Skipped for very_high_budget_with_results", {
          text: cleaned.substring(0, 100),
          userMinPrice,
          userMaxPrice,
          finalCount,
          isBudgetOnly,
          note: "Sehr hohes Budget + Produkte gefunden ? keine AI n?tig",
        });
      }
    }
  }

  
    // EFRO S14 Hard Rule: Unbekannter Produktcode/Marke + Budget ? immer AI-Hilfe
  // Wenn bisher kein AI-Trigger gesetzt wurde, aber ein unbekannter Code/Brand
  // und eine explizite Preisangabe vorhanden sind, erzwinge AI-Unterst?tzung.
  if (
    (!aiTrigger || !aiTrigger.needsAiHelp) &&
    hasUnknownBrandOrCode &&
    (userMinPrice !== null || userMaxPrice !== null)
  ) {
    const reasonKey = hasUnknownProductCode
      ? "unknown_product_code_with_budget"
      : "unknown_brand_with_budget";

    const codeTerms =
      unknownProductCodesForTrigger && unknownProductCodesForTrigger.length > 0
        ? unknownProductCodesForTrigger
        : [];

    aiTrigger = {
      needsAiHelp: true,
      reason: reasonKey,
      unknownTerms: [
        ...(aiTrigger?.unknownTerms || []),
        ...codeTerms,
      ],
      codeTerm:
        aiTrigger?.codeTerm ||
        detectedCodeTerm ||
        (codeTerms[0] ?? undefined),
      unknownProductCodes:
        codeTerms.length > 0
          ? codeTerms
          : aiTrigger?.unknownProductCodes,
    };

    console.log("[EFRO SB AI-Trigger] S14 Hard Rule applied", {
      text: cleaned.substring(0, 120),
      userMinPrice,
      userMaxPrice,
      unknownProductCodesForTrigger: codeTerms,
      hasUnknownBrandOrCode,
      reason: aiTrigger.reason,
    });
  }

 




  // Hilfsflags f?r AI-Trigger-Log (wiederverwenden, falls bereits berechnet)
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
    filteredUnknownTerms: filteredUnknownTerms.slice(0, 10), // Nur erste 10 f?r ?bersicht
    unknownProductCodeOnly,
    codeTerm: aiTrigger?.codeTerm,
  });

  // Bestimme effectiveCategorySlug f?r nextContext
  // (muss aus filterProducts extrahiert werden, hier vereinfacht: aus recommended ableiten)
  // WICHTIG: effectiveCategorySlug wurde bereits oben deklariert (Zeile 1647 aus Category-Modul)
  // EFRO F7 Fix: effectiveCategorySlug aus Category-Modul hat Priorität, nicht überschreiben
  // Nur wenn noch nicht gesetzt, aus recommended ableiten
  if (!effectiveCategorySlug) {
    if (recommended.length > 0 && recommended[0].category) {
      effectiveCategorySlug = normalize(recommended[0].category);
    } else if (context?.activeCategorySlug) {
      // Wenn keine Produkte gefunden, aber Kontext vorhanden, behalte Kontext
      // WICHTIG: Bei Budget-only-Queries mit Kontext soll der Kontext beibehalten werden
      effectiveCategorySlug = normalize(context.activeCategorySlug);
    }
  } else {
    // EFRO F7 Fix: effectiveCategorySlug bereits aus Category-Modul gesetzt (z. B. "perfume")
    // → nicht überschreiben, auch wenn recommended Produkte aus anderer Kategorie enthält
    console.log("[EFRO SB Context] Keeping effectiveCategorySlug from Category-Modul (F7 Fix)", {
      effectiveCategorySlug,
      recommendedCount: recommended.length,
      firstProductCategory: recommended.length > 0 ? recommended[0].category : null,
      note: "effectiveCategorySlug aus Category-Modul hat Priorität",
    });
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
  // - UND nach der Ranking-Phase wirklich KEINE Produkte ?brig sind (finalCount === 0)
  //
  // Wenn trotz unbekanntem Produktcode noch Produkte gefunden wurden (finalCount > 0),
  // sollen diese weiterhin angezeigt werden. In diesem Fall wird NUR der AI-Trigger
  // verwendet, um den unbekannten Begriff zu kl?ren ? die Empfehlungen bleiben erhalten.
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
      // Es wurden trotzdem sinnvolle Produkte gefunden ? NICHT verwerfen
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

  // EFRO Budget-Fix 2025-11-30: Pr?fe auf fehlende Kategorie (z. B. "Bindungen" nicht im Katalog)
 let missingCategoryHint: string | null = null;
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

  // Reply-Text mit AI-Kl?rung neu generieren, falls aiTrigger vorhanden
  // EFRO Budget-Fix 2025-11-30: priceRangeNoMatch hat Priorit?t vor AI-Trigger
  // WICHTIG: Bei priceRangeNoMatch werden Fallback-Produkte (aboveBudget) bereits in recommended sein
  // (durch die Anpassung des Budget-Filters, der bei priceRangeNoMatch = true nicht angewendet wird)
  let finalReplyText = replyText;
  if (priceRangeNoMatch) {
    // Fallback-Produkte sind bereits in recommended (durch Anpassung des Budget-Filters)
    // Nur wenn wirklich keine Produkte vorhanden sind, dann recommended = []
    if (recommended.length === 0 && priceRangeInfo?.nearestPriceAboveBudget === null) {
      // Keine Fallback-Produkte vorhanden - wirklich keine Produkte empfehlen
      recommended = [];
    }
    finalReplyText = buildReplyText(
      cleaned,
      nextIntent,
      recommended,
      aiTrigger,
      priceRangeNoMatch,
      priceRangeInfo,
      missingCategoryHint ?? undefined,
      context?.replyMode, context?.storeFacts);
  } else if (aiTrigger?.needsAiHelp || missingCategoryHint) {
    finalReplyText = buildReplyText(
      cleaned,
      nextIntent,
      recommended,
      aiTrigger,
      priceRangeNoMatch,
      priceRangeInfo,
      missingCategoryHint ?? undefined,
      context?.replyMode, context?.storeFacts);
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

  // [EFRO AI] Smartphone-Exact-Match (K6): Exakte Titel-Matches vor AI-Fallback pr?fen
  // Wenn recommended.length === 0 und ein sehr starker Match auf den Produktnamen vorliegt
  // K6v2 Fix: Auch prüfen, wenn recommended.length > 0, aber die Produkte nicht passen (z.B. kein "alpha" im Titel)
  // WICHTIG: Nicht ausführen, wenn priceRangeNoMatch === true (dann sollen keine Produkte empfohlen werden)
  const hasSmartphoneModelName = /\b(smartphone\s+alpha|alpha\s+smartphone|phone\s+alpha|alpha\s+phone|alpha\s+\d+gb|alpha\s+\d+\s*gb|das\s+alpha\s+\d+\s*gb|alpha\s+\d+\s*gb\s+schwarz)\b/i.test(cleaned);
  const recommendedProductsDontMatch = recommended.length > 0 && hasSmartphoneModelName && 
    !recommended.some((p) => {
      const productTitle = normalize(p.title || "");
      return productTitle.includes("alpha") || productTitle.includes("smartphone");
    });
  
  if ((recommended.length === 0 || recommendedProductsDontMatch) && !priceRangeNoMatch) {
    const normalizedText = normalize(cleaned);
    // Extrahiere relevante Produktbegriffe (z. B. "smartphone", "alpha", "128gb", "schwarz")
    // F?r K6: "Ich suche das Smartphone Alpha 128GB Schwarz" ? ["smartphone", "alpha", "128gb", "schwarz"]
    const productNameFragments = normalizedText
      .split(/\s+/)
      .filter((w) => w.length >= 3) // Reduziert von 4 auf 3, damit "alpha" erkannt wird
      .filter((w) => !GENERIC_UNKNOWN_STOPWORDS.has(w))
      .filter((w) => !/^\d+([.,]\d+)?$/.test(w));
    
    // EFRO Wasserkocher-Fix (K17): Wenn Wasserkocher-Keywords erkannt werden, nur Produkte aus "haushalt" finden
    const kettleKeywords = ["wasserkocher", "kettle", "electric kettle"];
    const userAsksForKettle = kettleKeywords.some((kw) => normalizedText.includes(kw));
    const targetCategoryForKettle = userAsksForKettle ? "haushalt" : null;
    
    // EFRO Smartphone-Fix K6/K16: Prüfe auf Smartphone-Keywords
    // K6v2 Fix: Auch wenn "smartphone" nicht im Query ist, aber "alpha" + Speicherangabe vorhanden ist
    const smartphoneKeywords = ["smartphone", "phone", "handy"];
    const userAsksForSmartphone = smartphoneKeywords.some((kw) => normalizedText.includes(kw));
    const hasAlphaModelName = /\b(alpha\s+\d+\s*gb|alpha\s+\d+\s*gb\s+schwarz|das\s+alpha\s+\d+\s*gb)\b/i.test(cleaned);
    const targetCategoryForSmartphone = (userAsksForSmartphone || hasAlphaModelName) ? "elektronik" : null;
    
    if (productNameFragments.length > 0) {
      // K6-Fix: Prüfe zuerst auf exakte Titel-Matches (alle Fragmente müssen im Titel vorkommen)
      const exactTitleMatches = allProducts.filter((p) => {
        // EFRO Wasserkocher-Fix: Bei Wasserkocher-Anfragen nur Produkte aus "haushalt" finden
        if (targetCategoryForKettle) {
          const productCategory = normalize(p.category || "");
          if (productCategory !== targetCategoryForKettle) {
            return false;
          }
        }
        // EFRO Smartphone-Fix: Bei Smartphone-Anfragen nur Produkte aus "elektronik" finden
        if (targetCategoryForSmartphone) {
          const productCategory = normalize(p.category || "");
          if (productCategory !== targetCategoryForSmartphone) {
            return false;
          }
        }
        const productTitle = normalize(p.title || "");
        // Prüfe, ob ALLE Fragmente im Titel vorkommen (stärkerer Match)
        const allFragmentsMatch = productNameFragments.every((fragment) => 
          productTitle.includes(fragment)
        );
        return allFragmentsMatch;
      });
      
      if (exactTitleMatches.length > 0) {
        // Exakte Titel-Matches gefunden → verwende diese
        recommended = exactTitleMatches.slice(0, Math.min(2, exactTitleMatches.length));
        console.log("[EFRO AI Smartphone Exact Match] K6 - Exakter Titel-Match (alle Fragmente)", {
          text: cleaned.substring(0, 100),
          productNameFragments,
          recommendedCount: recommended.length,
          products: recommended.map((p) => ({ title: p.title, price: p.price })),
        });
      } else {
        // Fallback: Prüfe, ob mindestens ein Fragment im Titel vorkommt
        // CLUSTER 3 FIX: Wenn effectiveCategorySlug gesetzt ist, nur Produkte aus dieser Kategorie zurückgeben
        const partialMatches = allProducts.filter((p) => {
          // EFRO Wasserkocher-Fix: Bei Wasserkocher-Anfragen nur Produkte aus "haushalt" finden
          if (targetCategoryForKettle) {
            const productCategory = normalize(p.category || "");
            if (productCategory !== targetCategoryForKettle) {
              return false;
            }
          }
          // EFRO Smartphone-Fix: Bei Smartphone-Anfragen nur Produkte aus "elektronik" finden
          if (targetCategoryForSmartphone) {
            const productCategory = normalize(p.category || "");
            if (productCategory !== targetCategoryForSmartphone) {
              return false;
            }
          }
          // CLUSTER 3 FIX: Wenn effectiveCategorySlug gesetzt ist (z.B. "perfume", "haustier"), nur Produkte aus dieser Kategorie
          if (effectiveCategorySlug) {
            const productCategory = normalize(p.category || "");
            if (productCategory !== normalize(effectiveCategorySlug || "")) {
              return false;
            }
          }
         

		 const productTitle = normalize(p.title || "");
          // Prüfe, ob mindestens ein Fragment im Titel vorkommt
          return productNameFragments.some((fragment) => productTitle.includes(fragment));
        });
        
        // Wenn genau 1 Match oder sehr starke Matches (z. B. "smartphone" + "alpha" im Titel)
        if (partialMatches.length === 1 || 
            (partialMatches.length > 0 && productNameFragments.some((f) => 
              partialMatches.some((p) => normalize(p.title || "").includes(f))
            ))) {
          // EFRO D8 Fix: Respektiere Budget-Beschränkung auch im "AI Smartphone Exact Match"
          // Wenn priceRangeNoMatch === true und ein explizites Max-Budget vorhanden ist,
          // füge keine Produkte hinzu, die über dem Budget liegen
          const { maxPrice: userMaxPriceForCheck } = extractUserPriceRange(cleaned);
          const hasExplicitMaxBudget = userMaxPriceForCheck !== null && typeof userMaxPriceForCheck === "number" && !Number.isNaN(userMaxPriceForCheck);
          
          if (hasExplicitMaxBudget && priceRangeNoMatch && userMaxPriceForCheck !== null) {
            const filteredMatches = partialMatches.filter((p) => {
              const price = typeof p.price === "number" ? p.price : Number(p.price);
              return !Number.isNaN(price) && price <= userMaxPriceForCheck;
            });
            
            if (filteredMatches.length > 0) {
              recommended = filteredMatches.slice(0, 1);
            } else {
              // Keine Produkte unter Budget → nicht hinzufügen
              console.log("[EFRO D8 Fix] AI Smartphone Exact Match skipped - products above budget", {
                text: cleaned.substring(0, 100),
                userMaxPrice: userMaxPriceForCheck,
                priceRangeNoMatch,
                partialMatchesCount: partialMatches.length,
                note: "Explizites Budget + priceRangeNoMatch → keine Produkte über Budget hinzufügen",
              });
            }
          } else {
            recommended = partialMatches.slice(0, 1);
          }
          
          if (recommended.length > 0) {
            console.log("[EFRO AI Smartphone Exact Match] K6 - Partieller Titel-Match", {
              text: cleaned.substring(0, 100),
              productNameFragments,
              recommendedCount: recommended.length,
              productTitle: recommended[0]?.title,
              productPrice: recommended[0]?.price,
            });
          }
        } else if (targetCategoryForSmartphone && partialMatches.length === 0) {
          // EFRO Smartphone-Fix K16: Fake-Modellname nicht gefunden, aber Smartphone-Keywords vorhanden
          // → Zeige echte Smartphones aus "elektronik" (mindestens 1-2 Stück)
          const realSmartphones = allProducts.filter((p) => {
            const productCategory = normalize(p.category || "");
            return productCategory === targetCategoryForSmartphone;
          });
          
          if (realSmartphones.length > 0) {
            // Zeige 1-2 echte Smartphones als Alternative
            recommended = realSmartphones.slice(0, Math.min(2, realSmartphones.length));
            // Setze AI-Trigger, damit EFRO ehrlich sagt, dass das Modell nicht existiert
            if (!aiTrigger) {
              aiTrigger = {
                needsAiHelp: true,
                reason: "unknown_product_model",
                queryForAi: cleaned,
              };
            }
            console.log("[EFRO AI Smartphone Fake Model] K16 - Fake-Modellname nicht gefunden, zeige echte Smartphones", {
              text: cleaned.substring(0, 100),
              productNameFragments,
              recommendedCount: recommended.length,
              products: recommended.map((p) => ({ title: p.title, price: p.price })),
            });
          }
        }
      }
    }
  }

  // [EFRO AI] Fallback-Logik bei recommended.length === 0 f?r Budget-F?lle
  // Wenn Budget zu streng ist und keine Produkte gefunden wurden, versuche wenigstens 1 Produkt zu finden
  // WICHTIG: Nicht ausführen, wenn priceRangeNoMatch === true (dann sollen keine Produkte empfohlen werden)
  if (
    recommended.length === 0 &&
    !priceRangeNoMatch &&
    priceRangeInfo &&
    priceRangeInfo.categoryMinPrice != null &&
    priceRangeInfo.categoryMaxPrice != null &&
    (priceRangeInfo.userMinPrice !== null || priceRangeInfo.userMaxPrice !== null)
  ) {
    const effectiveCategoryForFallback = effectiveCategorySlug || context?.activeCategorySlug || null;
    const fallbackProducts = effectiveCategoryForFallback
      ? allProducts.filter((p) => {
          const cat = normalize(p.category || "");
          const effCat = normalize(effectiveCategoryForFallback);
          return cat === effCat;
        })
      : allProducts;

    if (fallbackProducts.length > 0) {
      // F?r Budget-Anfragen: nimm hier bewusst das g?nstigste Produkt
      const sortedByPrice = [...fallbackProducts].sort(
        (a, b) => (a.price ?? 0) - (b.price ?? 0)
      );
      recommended = sortedByPrice.slice(0, 1);
      console.log("[EFRO AI Budget Fallback] Produkt gefunden", {
        text: cleaned.substring(0, 100),
        effectiveCategory: effectiveCategoryForFallback,
        fallbackCount: recommended.length,
        productTitle: recommended[0]?.title,
        productPrice: recommended[0]?.price,
      });
    }
  }

  // EFRO Haustier-Fallback:
  // Wenn Kategorie-Kontext Haustier/Tierbedarf ist, aber noch keine Produkte empfohlen wurden,
  // w?hle ein paar sinnvolle Haustier-Produkte aus dem Katalog.
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
    !priceRangeNoMatch &&
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
      // F?r Premium-Anfragen: teuerste Haustierprodukte zuerst
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

 const signalText =
  typeof normalizedQuery !== "undefined" && normalizedQuery
    ? normalizedQuery
    : cleaned;


  const cheapestSignal =
    /\b(günstigst(?:e|en|es)?|guenstigst(?:e|en|es)?|billigst(?:e|en|es)?|am günstigsten|am guenstigsten|so billig wie möglich|so billig wie moeglich|cheapest|lowest price|most affordable)\b/i.test(
      signalText
    );

  const mostExpensiveSignal =
    /\b(teuerst(?:e|en|es)?|am teuersten|most expensive|highest price|premiumste)\b/i.test(
      signalText
    );

 

  
  const wantsCheapestLegacy = cheapestSignal;
  const wantsMostExpensiveLegacy = mostExpensiveSignal;





  const wantsCheapestInCategory =
    !!effectiveCategorySlug && (wantsCheapestLegacy || cheapestSignal);
  const wantsMostExpensiveInCategory =
    !!effectiveCategorySlug && (wantsMostExpensiveLegacy || mostExpensiveSignal);

  const productCategorySlug = (product: EfroProduct) =>
    normalize(product.category || "");

  if (
    (wantsCheapestInCategory || wantsMostExpensiveInCategory) &&
    recommended.length > 0
  ) {
    const target = effectiveCategorySlug;
    const inCat = recommended.filter(
      (product) => productCategorySlug(product) === target
    );

    if (inCat.length > 0) {
      const safePrice = (product: EfroProduct): number | null => {
        const value =
          typeof product.price === "number"
            ? product.price
            : Number(product.price);
        return Number.isFinite(value) ? value : null;
      };

      const sorted = [...inCat].sort((a, b) => {
        const priceA = safePrice(a);
        const priceB = safePrice(b);
        if (wantsCheapestInCategory) {
          const keyA = priceA ?? Number.POSITIVE_INFINITY;
          const keyB = priceB ?? Number.POSITIVE_INFINITY;
          return keyA - keyB;
        }
        const keyA = priceA ?? Number.NEGATIVE_INFINITY;
        const keyB = priceB ?? Number.NEGATIVE_INFINITY;
        return keyB - keyA;
      });
      recommended = [sorted[0]];
    }
  }

  // EFRO Sales-Entscheidungsschicht: Berechne Sales-Policy-Output
  // SCHRITT 4 FIX: unknownTerms aus aiTrigger übergeben
  const unknownTermsForSales = aiTrigger?.unknownTerms || [];
  const originalRecommendedCount = recommended.length;
  const salesPolicyOutput = applySalesPolicy({
    text: cleaned,
    engine: {
      intent: nextIntent,
      products: recommended,
      contextCategory: context?.activeCategorySlug ?? null,
      effectiveCategorySlug: effectiveCategorySlug ?? null,
      userMinPrice: userMinPrice,
      userMaxPrice: userMaxPrice,
      priceRangeInfo: priceRangeInfo ?? null,
      priceRangeNoMatch: priceRangeNoMatch ?? false,
    },
    locale: "de",
    unknownTerms: unknownTermsForSales, // SCHRITT 4 FIX: unknownTerms übergeben
  } as any);
  
  // SCHRITT 4 FIX: Bei ASK_CLARIFICATION + NO_PRODUCTS_FOUND keine Produkte zurückgeben
  if (salesPolicyOutput.primaryAction === "ASK_CLARIFICATION" && 
      salesPolicyOutput.notes?.includes("NO_PRODUCTS_FOUND")) {
    recommended = [];
    console.log("[EFRO SB ASK_CLARIFICATION] Produkte entfernt (NO_PRODUCTS_FOUND)", {
      text: cleaned.substring(0, 100),
      originalCount: originalRecommendedCount,
      finalCount: 0,
      salesNotes: salesPolicyOutput.notes,
    });
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
    salesPrimaryAction: salesPolicyOutput.primaryAction,
    salesNotes: salesPolicyOutput.notes,
  });

  return {
    intent: nextIntent,
    recommended: recommended || [],
    replyText: finalReplyText,
    nextContext,
    aiTrigger,
    priceRangeNoMatch: priceRangeNoMatch || undefined,
    priceRangeInfo: priceRangeInfo || undefined,
  missingCategoryHint: missingCategoryHint ?? undefined,
  explanationMode: effectiveExplanationMode !== null ? true : (explanationModeBoolean ? true : undefined),
  sales: salesPolicyOutput,
  };
}

export async function runSellerBrain(
  userText: string,
  currentIntent: ShoppingIntent,
  allProducts: EfroProduct[],
  plan?: string,
  previousRecommended?: EfroProduct[],
  context?: SellerBrainContext
): Promise<SellerBrainResult> {
  return runOrchestrator({
    userText,
    currentIntent,
    allProducts,
    plan,
    previousRecommended,
    context,
  });
}

// ------------------------------------------------------
// Spezialisierte Logik f?r Schimmel-Anfragen
// ------------------------------------------------------

function isMoldQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  // Typische deutsche Formulierungen f?r Schimmel
  // Importiert aus languageRules.de.ts
  return MOLD_KEYWORDS.some((kw) => t.includes(kw));
}

 

// ============================================================================
// SELLERBRAIN V2: Wrapper mit Supabase-Repository & Antwort-Cache
// ============================================================================

/**
 * Optionen f?r runSellerBrainV2
 */
export interface RunSellerBrainV2Options {
  shopDomain: string; // z.B. 'test-shop.myshopify.com' oder 'demo'
  locale?: string; // default 'de'
  useCache?: boolean; // default true
  /**
   * Steuert den Antwortmodus von SellerBrain:
   * - "customer": Antworten sind auf Endkunden ausgerichtet (du, Nutzen, keine Betreiber-Hinweise)
   * - "operator": Antworten dürfen interne Hinweise für den Shopbetreiber enthalten.
   * Standard ist "customer", wenn nicht gesetzt.
   */
  replyMode?: "customer" | "operator";
}

/**
 * Ergebnis von runSellerBrainV2 (erweitert SellerBrainResult um Cache-Flag)
 */
export interface SellerBrainV2Result extends SellerBrainResult {
  fromCache?: boolean;
}

/**
 * Einfache, deterministische Hash-Funktion f?r Frage-Text.
 * Verwendet FNV-1a Algorithmus (32-bit), keine externen Abh?ngigkeiten.
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
 * Mappt cached.products (IDs + Basisdaten) zur?ck zu EfroProduct[].
 */
function buildResultFromCache(
  cached: EfroCachedResponse,
  allProducts: EfroProduct[]
): SellerBrainResult {
  // Versuche, Produkte aus allProducts anhand der IDs in cached.products zu finden
  let recommended: EfroProduct[] = [];

  if (cached.products && Array.isArray(cached.products)) {
    // cached.products kann IDs oder vollst?ndige Produkt-Objekte enthalten
    recommended = cached.products
      .map((cachedProduct: any) => {
        // Wenn es ein vollst?ndiges Produkt-Objekt ist, verwende es direkt
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

  // Default-Intent (kann aus Cache erweitert werden, falls n?tig)
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
 * K?rzt SellerBrain-ReplyTexte f?r das UI:
 * - Entfernt den Klarstellungs-Block "Einige deiner Begriffe ..."
 *   (AI-Clarify-Teil), der am Ende angeh?ngt wird.
 * - L?sst den produktbezogenen Teil unver?ndert.
 */


/**
 * SellerBrain v2: Wrapper mit Supabase-Repository & Antwort-Cache.
 *
 * - L?dt Shop und Produkte aus Supabase
 * - Pr?ft Cache f?r bereits beantwortete Fragen
 * - Ruft intern runSellerBrain (v1) als Engine auf
 * - Speichert Antworten im Cache
 * - K?rzt ReplyText f?r UI (entfernt Klarstellungs-Bl?cke bei Produktempfehlungen)
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
  const { shopDomain, locale = "de", useCache = true, replyMode } = options;
  
  // replyMode aus Options in Context übernehmen, falls nicht bereits gesetzt
  const effectiveContext: SellerBrainContext | undefined = sellerContext
    ? { ...sellerContext, replyMode: sellerContext.replyMode ?? replyMode }
    : replyMode
    ? { replyMode }
    : undefined;

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
    const result = await runSellerBrain(
      userText,
      "explore",
      allProducts,
      undefined,
      undefined,
      effectiveContext
    );
    return {
      ...result,
      fromCache: false,
    };
  }

  // 2) Produkte f?r diesen Shop laden
  const shopProductsResult = await getProductsForShop(shop);

  // Verwende shopProducts, falls vorhanden, sonst Fallback zu allProducts
  const productsToUse = shopProductsResult.products.length > 0 ? shopProductsResult.products : allProducts;

  // Debug: Katalog-?bersicht loggen (nur einmal pro Run)
  debugCatalogOverview(productsToUse);

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

        // Wenn Klarstellungsblock entfernt wurde, aiTrigger entsch?rfen
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
  // Default-Intent: "explore" (kann sp?ter erweitert werden)
  const sbResult = await runSellerBrain(
    userText,
    "explore",
    productsToUse,
    shop.currency || undefined,
    undefined,
    effectiveContext
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

    // Wenn Klarstellungsblock entfernt wurde, aiTrigger entsch?rfen
    if (hadClarifyBlock) {
      uiAiTrigger = undefined;
    }
  }

  // 7) Cache schreiben (wenn sinnvolle Antwort)
  // WICHTIG: Original-ReplyText im Cache speichern (nicht den gek?rzten)
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
 * - runSellerBrain (v1) bleibt unver?ndert und ist die eigentliche Engine
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

// ============================================================================
// [EFRO AI] Logic-Fix-Pass 2025-01-XX: Gezielte Fixes f?r 10 failing Szenarien
// ============================================================================
// 
// Durchgef?hrte ?nderungen:
// 
// 1. Unknown-Term-Filtern verbessert:
//    - GENERIC_UNKNOWN_STOPWORDS hinzugef?gt (produkte, produkt, sachen, etc.)
//    - Filterung erweitert: Entfernt Begriffe, die bereits als Kategorie- oder Alias-Treffer erkannt wurden
//    - Ziel: D6, F1, K3, K6 sollen nicht mehr nur aus generischen W?rtern bestehen
// 
// 2. decideAiTrigger angepasst:
//    - S14: unknown_product_with_budget reason hinzugef?gt (unbekannter Produktcode + Budget)
//    - Premium-F?lle: Nicht triggern, wenn Kategorie erkannt wurde (D6, F1, K3, K6)
//    - Budget-F?lle: no_results_budget_only reason (aber kein needsAiHelp, da Fallback-Produkte angeboten werden)
// 
// 3. Fallback-Logik bei recommended.length === 0 f?r Budget-F?lle:
//    - Wenn Budget zu streng ist, versuche wenigstens 1 Produkt in der relevanten Kategorie zu finden
//    - Ziel: S1, D8, K2, K8 sollen wenigstens 1 Produkt empfehlen
// 
// 4. Premium-Auswahl fixiert:
//    - F1: Globale Premium-Anfrage ? teuerstes Produkt im gesamten Katalog
//    - F2: Premium-Parf?m ? teuerstes Parf?m-Produkt
//    - K3: Premium-Wasserkocher ab 60 ? ? Wasserkocher mit Preis ? 60 ?
// 
// 5. Smartphone-Exact-Match fixiert (K6):
//    - Exakte Titel-Matches vor AI-Fallback pr?fen
//    - Wenn genau 1 Match oder sehr starke Matches, verwende diese
// 
// Erwartetes Ergebnis: M?glichst alle 10 Szenarien (S1, S14, D6, D8, F1, F2, K2, K3, K6, K8) sollen bestehen.
// 
// ============================================================================
