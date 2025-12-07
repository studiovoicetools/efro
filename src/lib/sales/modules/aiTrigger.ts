// src/lib/sales/modules/aiTrigger.ts

/**
 * Budget-Stopwords: Wörter, die in Budget-Kontexten vorkommen, aber keine echten unbekannten Begriffe sind
 */
const BUDGET_STOPWORDS = new Set([
  "mein", "meine", "meinen", "meinem", "meiner",
  "budget", "preis", "kosten", "preise", "kosten",
  "liegt", "liegen", "liegende",
  "zwischen", "unter", "über", "bis", "ab", "von",
  "und", "oder",
  "euro", "eur", "€", "dollar", "$",
]);

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
 * Zentrale Hilfsfunktion zur Entscheidung über AI-Trigger
 * 
 * Implementiert die Logik für:
 * - G3: Budget unter 20 Euro → needsAiHelp === true
 * - J1: Sehr hohes Budget → needsAiHelp === false
 * - S14: Unbekannter Produktcode mit Budget → needsAiHelp === true
 * - Unbekannte Begriffe → needsAiHelp === true
 * 
 * @param options - Budget- und Kategorie-Informationen sowie unbekannte Begriffe
 * @returns SellerBrainAiTrigger | undefined
 */
export function decideAiTrigger(options: {
  userMinPrice: number | null;
  userMaxPrice: number | null;
  categoryMinPrice: number | null;
  categoryMaxPrice: number | null;
  unknownTerms: string[];
  resolvedUnknownTerms: string[];
  codeTerm?: string;
  unknownProductCodeOnly?: boolean;
  hasCategoryMatch?: boolean;
  priceRangeNoMatch?: boolean;
  normalizedText?: string;
}): SellerBrainAiTrigger | undefined {
  const {
    userMinPrice,
    userMaxPrice,
    categoryMinPrice,
    categoryMaxPrice,
    unknownTerms,
    resolvedUnknownTerms,
    codeTerm,
    unknownProductCodeOnly,
    hasCategoryMatch,
    priceRangeNoMatch,
    normalizedText,
  } = options;

  // Berechne gefilterte unbekannte Begriffe (nicht eindeutig aufgelöst)
  const hasUnknownTerms = unknownTerms.length > 0;
  const hasStrongResolutions = resolvedUnknownTerms.length > 0 && 
    resolvedUnknownTerms.some(term => term.length >= 3);
  let filteredUnknownTerms = hasUnknownTerms && !hasStrongResolutions 
    ? unknownTerms 
    : [];

  // Filtere Budget-Stopwords aus filteredUnknownTerms
  // Für reine Budget-Sätze ohne echte unbekannte Begriffe soll needsAiHelp nicht auf true springen
  filteredUnknownTerms = filteredUnknownTerms.filter(term => {
    const normalizedTerm = term.toLowerCase().trim();
    return !BUDGET_STOPWORDS.has(normalizedTerm);
  });

  // HARTE REGEL S14: Unbekannter Begriff + Budget → AI MUSS true sein
  // Diese Regel hat höchste Priorität und greift VOR allen anderen Budget-Regeln (G3/J1)
  // WICHTIG: Nur wenn nach Filterung noch echte unbekannte Begriffe vorhanden sind
  if (filteredUnknownTerms.length > 0 &&
      (userMaxPrice !== null || userMinPrice !== null)) {
    const trigger: SellerBrainAiTrigger = {
      needsAiHelp: true,
      reason: "unknown-terms-with-budget",
    };
    console.log("[EFRO SB AI-TRIGGER] Unknown terms with budget -> AI", {
      unknownTerms,
      filteredUnknownTerms,
      userMinPrice,
      userMaxPrice,
      trigger,
    });
    return trigger;
  }

  // Regel 1: Budget viel zu niedrig (G3-Fall)
  // Wenn userMaxPrice gesetzt ist
  // und categoryMinPrice gesetzt ist
  // und userMaxPrice < categoryMinPrice
  // und categoryMinPrice >= userMaxPrice * 1.5
  // dann: needsAiHelp = true
  if (
    userMaxPrice !== null &&
    categoryMinPrice !== null &&
    userMaxPrice < categoryMinPrice &&
    categoryMinPrice >= userMaxPrice * 1.5
  ) {
    return {
      needsAiHelp: true,
      reason: "budget_very_low",
      unknownTerms: unknownTerms.length > 0 ? unknownTerms : undefined,
    };
  }

  // Regel 2: Sehr hohes Budget (J1-Fall)
  // Wenn userMaxPrice deutlich über categoryMaxPrice liegt (z. B. userMaxPrice >= categoryMaxPrice * 1.5)
  // UND keine unbekannten Begriffe übrig sind
  // DANN: needsAiHelp = false, reason = "budget-clear-no-ai"
  if (
    userMaxPrice !== null &&
    categoryMaxPrice !== null &&
    categoryMinPrice !== null &&
    userMaxPrice >= categoryMaxPrice * 1.5 &&
    filteredUnknownTerms.length === 0
  ) {
    // EFRO kann problemlos Produkte empfehlen, AI ist hier nicht nötig
    const aiTrigger = {
      needsAiHelp: false,
      reason: "budget-clear-no-ai" as const,
    };
    console.log("[EFRO SB AI-TRIGGER]", {
      hasUnknownTerms,
      filteredUnknownTerms,
      userMinPrice,
      userMaxPrice,
      categoryMinPrice,
      categoryMaxPrice,
      result: aiTrigger,
    });
    return aiTrigger;
  }

  // Spezialfall: Verdächtiges Budget (sehr groß) + unbekannte Begriffe oder Hinweise auf "unter/bis/höchstens/günstig"
  // Wenn userMaxPrice >= 2000 UND (Hinweise auf "unter", "bis", "höchstens" oder "günstig/billig" im Text ODER filteredUnknownTerms/unknownTerms nicht leer)
  // WICHTIG: Diese Regel kommt NACH Regel 2 (J1), damit sehr hohe Budgets ohne unbekannte Begriffe nicht getriggert werden
  if (userMaxPrice !== null && userMaxPrice >= 2000) {
    const hasUnknownTermsOrFiltered = filteredUnknownTerms.length > 0 || unknownTerms.length > 0;
    const hasBudgetHints = normalizedText 
      ? /\b(unter|bis|hoechstens|höchstens|maximal|max|günstig|guenstig|billig|preiswert|cheap)\b/i.test(normalizedText)
      : false;
    
    if (hasBudgetHints || hasUnknownTermsOrFiltered) {
      const aiTrigger = {
        needsAiHelp: true,
        reason: "suspicious-budget-unknown-term" as const,
        unknownTerms: filteredUnknownTerms.length > 0 ? filteredUnknownTerms : (unknownTerms.length > 0 ? unknownTerms : undefined),
      };
      console.log("[EFRO AiTrigger] Suspicious budget -> AI", {
        text: normalizedText || "(no text)",
        userMaxPrice,
        hasBudgetHints,
        hasUnknownTermsOrFiltered,
        filteredUnknownTerms,
        unknownTerms,
        result: aiTrigger,
      });
      return aiTrigger;
    }
  }

  // [EFRO AI] Regel 3: Unbekannter Produktcode mit Budget (S14-Fall)
  // Wenn ein Budget vorhanden ist (userMinPrice oder userMaxPrice gesetzt)
  // UND ein unbekannter Produktcode vorhanden ist (codeTerm oder unknownProductCodeOnly)
  // DANN: needsAiHelp = true, reason = 'unknown_product_with_budget'
  const hasBudget = userMinPrice !== null || userMaxPrice !== null;
  if (hasBudget && (codeTerm || unknownProductCodeOnly)) {
    return {
      needsAiHelp: true,
      reason: "unknown_product_with_budget",
      unknownTerms: unknownTerms.length > 0 ? unknownTerms : undefined,
      codeTerm: codeTerm,
    };
  }

  // [EFRO AI] Regel 3a: Unbekannter Begriff + Budget (S14-Fall)
  // Wenn unbekannte Begriffe existieren, die NICHT eindeutig aufgelöst wurden
  // UND der Nutzer ein Budget mitgegeben hat (userMaxPrice oder userMinPrice gesetzt)
  // DANN: needsAiHelp = true, reason = "unknown-terms-with-budget"
  if (hasBudget && filteredUnknownTerms.length > 0) {
    const aiTrigger = {
      needsAiHelp: true,
      reason: "unknown-terms-with-budget" as const,
      unknownTerms: filteredUnknownTerms,
    };
    console.log("[EFRO SB AI-TRIGGER]", {
      hasUnknownTerms,
      filteredUnknownTerms,
      userMinPrice,
      userMaxPrice,
      categoryMinPrice,
      categoryMaxPrice,
      result: aiTrigger,
    });
    return aiTrigger;
  }

  // Regel 3b: Unbekannter Begriff + Budget (alte Heuristik als Fallback)
  // Wenn ein Budget vorhanden ist (userMinPrice oder userMaxPrice gesetzt)
  // UND unknownTerms.length > 0
  // UND die unbekannten Begriffe wie Produkt/Code aussehen (z. B. XY-9000, ABC123)
  // DANN: needsAiHelp = true, reason = 'low_confidence_unknown_terms'
  if (hasBudget && unknownTerms.length > 0 && !codeTerm && !unknownProductCodeOnly) {
    // Prüfe, ob unbekannte Begriffe wie Produktcodes aussehen
    const hasCodeLikeTerms = unknownTerms.some((term) => {
      const t = term.toLowerCase().trim();
      // Mindestens 4 Zeichen, max 20
      if (t.length < 4 || t.length > 20) return false;
      // Keine reinen Zahlen
      if (/^[0-9]+$/.test(t)) return false;
      // Mischung aus Buchstaben und Zahlen (z. B. XY-9000, ABC123)
      const hasLetter = /[a-z]/i.test(t);
      const hasDigit = /\d/.test(t);
      if (hasLetter && hasDigit) return true;
      // Bindestrich oder Unterstrich enthalten (z. B. XY-9000)
      if (/[-_]/.test(t)) return true;
      return false;
    });
    
    if (hasCodeLikeTerms) {
      return {
        needsAiHelp: true,
        reason: "low_confidence_unknown_terms",
        unknownTerms: unknownTerms,
      };
    }
  }

  // [EFRO AI] Regel 4: Budget-Fälle ohne Produkte
  // Wenn priceRangeNoMatch === true UND unknownTerms leer oder harmlos sind
  // DANN: reason = 'no_results_budget_only', aber kein needsAiHelp (Fallback-Produkte werden angeboten)
  if (priceRangeNoMatch && unknownTerms.length === 0) {
    // Kein AI-Trigger, da Fallback-Logik Produkte anbieten wird
    return undefined;
  }

  // Regel 5: Unbekannte Begriffe (ohne Budget)
  // [EFRO AI] Premium-/Kontext-Fälle: Wenn Kategorie erkannt wurde, nicht triggern
  // Wenn unknownTerms.length > 0
  // und resolvedUnknownTerms leer ist oder nur schwache Fuzzy-Treffer enthält
  // ABER: Wenn hasCategoryMatch === true, dann KEIN AI-Trigger (Premium-Fälle D6, F1, K3, K6)
  if (unknownTerms.length > 0) {
    // [EFRO AI] Premium-/Kontext-Fälle: Wenn Kategorie erkannt wurde, nicht triggern
    if (hasCategoryMatch && resolvedUnknownTerms.length > 0) {
      // Kategorie erkannt und Begriffe aufgelöst → kein AI-Trigger
      return undefined;
    }
    
    // Prüfe, ob resolvedUnknownTerms wirklich aufgelöst wurden
    // (nicht nur leere Array oder schwache Treffer)
    const hasStrongResolutions = resolvedUnknownTerms.length > 0 && 
      resolvedUnknownTerms.some(term => term.length >= 3);
    
    if (!hasStrongResolutions) {
      return {
        needsAiHelp: true,
        reason: "unknown_terms",
        unknownTerms: unknownTerms,
      };
    }
  }

  // Standard: Wenn keine der Regeln 1–5 greift, return undefined;
  const aiTrigger = undefined;
  console.log("[EFRO SB AI-TRIGGER]", {
    hasUnknownTerms,
    filteredUnknownTerms,
    userMinPrice,
    userMaxPrice,
    categoryMinPrice,
    categoryMaxPrice,
    result: aiTrigger,
  });
  return aiTrigger;
}


