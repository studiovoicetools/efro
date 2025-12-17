/**
 * EFRO Language Rule Resolution
 * 
 * Resolved einen Begriff über statische → dynamische → AI-Regeln
 */

import { CATEGORY_KEYWORDS } from "./languageRules.de";
import { loadDynamicLanguageRule, saveDynamicLanguageRule } from "./dynamicLanguageRules";
import type { LanguageRule, LanguageRuleAiResponse } from "./types";

/**
 * Normalisiert einen Begriff für die Suche
 */
function normalizeTerm(term: string): string {
  return term.toLowerCase().trim();
}

/**
 * Findet eine statische Sprachregel in CATEGORY_KEYWORDS
 */
function findStaticLanguageRule(term: string, locale: string): LanguageRule | null {
  if (locale !== "de") {
    // Aktuell nur deutsche Regeln implementiert
    return null;
  }

  const normalized = normalizeTerm(term);
  
  // Suche in CATEGORY_KEYWORDS
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => normalizeTerm(kw) === normalized || normalized.includes(normalizeTerm(kw)))) {
      return {
        term: normalized,
        locale,
        canonical: category,
        keywords: keywords,
        categoryHints: [category],
        source: "static",
      };
    }
  }

  return null;
}

/**
 * Fragt AI nach einer Sprachregel für einen unbekannten Begriff
 * 
 * HINWEIS: Diese Funktion wird aktuell über die bestehende AI-Trigger-Struktur
 * aufgerufen. Die eigentliche AI-Antwort wird extern verarbeitet.
 * 
 * Diese Funktion dient als Platzhalter für die spätere Integration.
 */
async function askAiForLanguageRule(
  term: string,
  locale: string
): Promise<LanguageRuleAiResponse | null> {
  // Diese Funktion wird aktuell NICHT direkt aufgerufen.
  // Stattdessen wird die AI über die bestehende AI-Trigger-Struktur
  // (sellerBrain.aiTrigger) aufgerufen, und die Antwort wird dann
  // über registerLanguageRuleFromAi() registriert.
  
  // Für zukünftige direkte AI-Integration:
  // - OpenAI-Client hier einbinden
  // - Prompt: "Der User-Begriff ist: 'fressnapf' ... beschreibe kurz, was das ist, gib typische Schlüsselwörter, und welche Produkt-Kategorien dazu passen"
  // - JSON-Response parsen: { canonical, keywords, categoryHints }
  
  return null;
}

/**
 * Registriert eine Sprachregel aus einer AI-Antwort
 * 
 * Wird typischerweise von der externen AI-Schicht aufgerufen,
 * nachdem eine AI-Antwort für einen unbekannten Begriff erhalten wurde.
 */
export async function registerLanguageRuleFromAi(
  term: string,
  locale: string,
  aiResponse: LanguageRuleAiResponse
): Promise<LanguageRule> {
  const normalized = normalizeTerm(term);
  
  const rule: LanguageRule = {
    term: normalized,
    locale,
    canonical: aiResponse.canonical ?? normalized,
    keywords: aiResponse.keywords ?? [],
    categoryHints: aiResponse.categoryHints ?? [],
    source: "ai",
  };

  // 1. Speichere in Supabase (persistent)
  await saveDynamicLanguageRule(rule);
  
  // 2. Registriere im Memory-Cache (für sofortige Nutzung im aktuellen Request)
  const { registerDynamicSynonym } = await import("./languageRules.de");
  registerDynamicSynonym({
    term: normalized,
    canonicalCategory: rule.canonical,
    canonical: rule.canonical,
    extraKeywords: rule.keywords,
    keywords: rule.keywords,
    categoryHints: rule.categoryHints,
  });
  
  console.log("[EFRO LanguageRule] Registered from AI", {
    term: normalized,
    locale,
    canonical: rule.canonical,
    keywordsCount: rule.keywords?.length ?? 0,
    categoryHintsCount: rule.categoryHints?.length ?? 0,
    savedToSupabase: true,
    registeredInMemory: true,
  });

  return rule;
}

/**
 * Resolved einen Begriff über statische → dynamische → AI-Regeln
 * 
 * @param term Der zu resolvende Begriff (z. B. "fressnapf")
 * @param locale Die Locale (z. B. "de")
 * @param aiRuleCache Per-Request-Cache für AI-Regeln (verhindert doppelte AI-Anfragen)
 * @returns Die gefundene Sprachregel oder null
 */
export async function resolveTermWithLanguageRules(
  term: string,
  locale: string = "de",
  aiRuleCache: Map<string, LanguageRule> = new Map()
): Promise<LanguageRule | null> {
  const normalized = normalizeTerm(term);
  const cacheKey = `${locale}:${normalized}`;

  // Prüfe Per-Request-Cache
  if (aiRuleCache.has(cacheKey)) {
    return aiRuleCache.get(cacheKey) ?? null;
  }

  // 1) STATIC
  const staticRule = findStaticLanguageRule(normalized, locale);
  if (staticRule) {
    aiRuleCache.set(cacheKey, staticRule);
    return staticRule;
  }

  // 2) DYNAMIC (Supabase)
  const dynamicRule = await loadDynamicLanguageRule(normalized, locale);
  if (dynamicRule) {
    aiRuleCache.set(cacheKey, dynamicRule);
    return dynamicRule;
  }

  // 3) AI-FALLBACK (wird über AI-Trigger-Struktur behandelt)
  // Die eigentliche AI-Anfrage wird über sellerBrain.aiTrigger gemacht,
  // und die Antwort wird dann über registerLanguageRuleFromAi() registriert.
  // Hier geben wir null zurück, damit sellerBrain den AI-Trigger setzen kann.
  
  return null;
}

