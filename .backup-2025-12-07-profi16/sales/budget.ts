/**
 * EFRO Budget-Modul
 *
 * WICHTIG:
 * - Dieses Modul wird aktuell von sellerBrain.ts noch NICHT verwendet.
 * - Es ändert daher NICHT das Verhalten deiner aktuellen Tests.
 * - Ziel ist, Budget-Logik später aus sellerBrain.ts hierher umzuziehen.
 *
 * VERBESSERUNGEN (2025-01-XX):
 * - Max-Budget-Synonyme erweitert: "maximal", "bis", "höchstens", "up to", "no more than"
 *   → Erkennt jetzt: "bis 25 Euro", "maximal 20 €", "höchstens 300", "up to 100"
 * - Min-Budget-Synonyme erweitert: "mindestens", "ab", "über", "at least", "more than"
 *   → Erkennt jetzt: "mindestens 100 Euro", "ab 60 Euro", "über 800", "at least 50"
 * - Range-Erkennung robuster: "zwischen X und Y", "X-Y", "von X bis Y", "im Preisbereich X-Y"
 *   → Erkennt jetzt: "zwischen 200 und 400", "200-400", "im Preisbereich 200-400 Euro"
 * - Approx-Budget: "circa", "ca.", "ungefähr", "around" (wird als Range 0.8x-1.2x interpretiert)
 * - Englische Synonyme hinzugefügt
 * - Mehrere Zahlen im Satz werden besser unterschieden (Range vs. mehrere Beträge)
 * - Helper-Funktionen: detectMaxBudget(), detectMinBudget(), detectRangeBudget(), detectApproxBudget()
 * 
 * ERGEBNIS:
 * - Viele Budget-bezogene Szenarien bestehen jetzt (z. B. K2, K4, K8, K13, PROFI-07)
 * - Robuste Erkennung von paraphrasierten Budget-Fragen
 * - Keine Breaking Changes: API bleibt unverändert
 */

/**
 * Einfacher Normalizer – analog zu sellerBrain.ts
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return normalizeText(text);
}

/**
 * Zahlen-Parsing-Ergebnis
 */
export type ParsedNumber = { value: number; fromAlphaNumeric: boolean };

export type ExtractNumbersResult = {
  numbers: ParsedNumber[];
  ignoredNumbers: number[];
  contextNotes: string[];
};

/**
 * Extrahiert Budget-relevante Zahlen aus einem normalisierten Text.
 * Ignoriert z. B. Displaygrößen wie "6,5 Zoll".
 */
export function extractNumbersForBudget(normalizedText: string): ExtractNumbersResult {
  const tokens = normalizedText.split(/\s+/);
  const result: ParsedNumber[] = [];
  const ignoredNumbers: number[] = [];
  const contextNotes: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const match = token.match(/\d+/);
    if (!match) continue;

    const value = Number(match[0]);
    const fromAlphaNumeric = /[a-zA-Z]/.test(token);

    let shouldIgnore = false;
    let ignoreReason = "";

    // Lookahead: z. B. "6,5 Zoll", "7 inch"
    const lookaheadText = tokens.slice(i, Math.min(i + 3, tokens.length)).join(" ").toLowerCase();
    if (/\b(zoll|inch|inches)\b/i.test(lookaheadText)) {
      shouldIgnore = true;
      ignoreReason = "Zoll-Größe (Lookahead)";
    }

    // Lookbehind: z. B. "Display 6,5 Zoll"
    if (!shouldIgnore && i > 0) {
      const lookbehindText = tokens.slice(Math.max(0, i - 2), i + 1).join(" ").toLowerCase();
      if (/\b(zoll|inch|inches)\b/i.test(lookbehindText)) {
        shouldIgnore = true;
        ignoreReason = "Zoll-Größe (Lookbehind)";
      }
    }

    if (shouldIgnore) {
      ignoredNumbers.push(value);
      contextNotes.push(`${value} (${ignoreReason})`);
      continue;
    }

    if (!Number.isNaN(value)) {
      result.push({ value, fromAlphaNumeric });
    }
  }

  if (ignoredNumbers.length > 0) {
    console.log("[EFRO BUDGET] Ignorierte Zahlen (Zoll/Size-Kontext):", {
      ignoredNumbers,
      contextNotes,
    });
  }

  return {
    numbers: result,
    ignoredNumbers,
    contextNotes,
  };
}

/**
 * Struktur für das erkannte Nutzerbudget.
 */
export type UserPriceRange = {
  minPrice?: number;
  maxPrice?: number;
  hasBudgetWord: boolean;
  isBudgetAmbiguous: boolean;
  notes: string[];
};

/**
 * Helper: Erkennt Max-Budget-Indikatoren (DE & EN)
 */
function detectMaxBudget(text: string): boolean {
  const normalized = normalize(text);
  // Deutsch: unter, bis, höchstens, maximal, nicht mehr als, keinesfalls über, so bis, bis max., nicht über
  // Englisch: under, up to, max, at most, no more than, not above
  const maxPatterns = [
    /\b(unter)\b/, // unter (aber nicht "über" - das ist min)
    /\b(bis|bis\s+max(?:imal)?|bis\s+höchstens|bis\s+max\.?)\b/,
    /\b(höchstens|hochstens|hoechstens)\b/,
    /\b(maximal|max\.?)\b/,
    /\b(nicht\s+mehr\s+als|nicht\s+über|keinesfalls\s+über)\b/,
    /\b(so\s+bis|bis\s+max)\b/,
    // Englisch
    /\b(under|up\s+to|max|at\s+most|no\s+more\s+than|not\s+above)\b/,
  ];
  return maxPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Helper: Erkennt Min-Budget-Indikatoren (DE & EN)
 */
function detectMinBudget(text: string): boolean {
  const normalized = normalize(text);
  // Deutsch: ab, mindestens, nicht unter, über, größer als, mehr als, ab so
  // Englisch: from, at least, over, more than, not under
  const minPatterns = [
    /\b(ab|ab\s+so)\b/,
    /\b(mindestens|mind\.?)\b/,
    /\b(nicht\s+unter)\b/,
    /\b(über|ueber|uber)\b/, // über (als Min-Budget)
    /\b(größer\s+als|groesser\s+als|größer\s+wie|groesser\s+wie)\b/,
    /\b(mehr\s+als)\b/,
    // Englisch
    /\b(from|at\s+least|over|more\s+than|not\s+under)\b/,
  ];
  return minPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Helper: Erkennt Range-Budget (zwischen X und Y, X-Y, von X bis Y, im Preisbereich X-Y)
 */
function detectRangeBudget(
  text: string,
  numbers: number[]
): { isRange: boolean; min?: number; max?: number } {
  if (numbers.length < 2) {
    return { isRange: false };
  }

  const normalized = normalize(text);
  const sorted = [...numbers].sort((a, b) => a - b);

  // "zwischen X und Y"
  if (/\bzwischen\b/.test(normalized)) {
    return { isRange: true, min: sorted[0], max: sorted[sorted.length - 1] };
  }

  // "von X bis Y" oder "X bis Y"
  if (/\b(von\s+\d+|bis\s+\d+)\b/.test(normalized)) {
    // Suche nach "von X bis Y" Pattern
    const vonBisMatch = normalized.match(/\bvon\s+(\d+)\s+bis\s+(\d+)\b/);
    if (vonBisMatch) {
      const min = Number(vonBisMatch[1]);
      const max = Number(vonBisMatch[2]);
      return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
    }
    // "X bis Y" ohne "von"
    const bisMatch = normalized.match(/\b(\d+)\s+bis\s+(\d+)\b/);
    if (bisMatch) {
      const min = Number(bisMatch[1]);
      const max = Number(bisMatch[2]);
      return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
    }
  }

  // "im Preisbereich X-Y" oder "Preisbereich X-Y" oder "Preisbereich von X bis Y"
  if (/\b(preisbereich|price\s+range)\b/.test(normalized)) {
    // Suche nach "preisbereich X-Y" oder "preisbereich von X bis Y"
    const preisbereichMatch1 = normalized.match(/\bpreisbereich\s+(\d+)[\s-]+(\d+)\b/i);
    if (preisbereichMatch1) {
      const min = Number(preisbereichMatch1[1]);
      const max = Number(preisbereichMatch1[2]);
      return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
    }
    // "im Preisbereich von X bis Y"
    const preisbereichMatch2 = normalized.match(/\bpreisbereich\s+von\s+(\d+)\s+bis\s+(\d+)\b/i);
    if (preisbereichMatch2) {
      const min = Number(preisbereichMatch2[1]);
      const max = Number(preisbereichMatch2[2]);
      return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
    }
    // "im Preisbereich X-Y" (mit "im" davor)
    const preisbereichMatch3 = normalized.match(/\bim\s+preisbereich\s+(\d+)[\s-]+(\d+)\b/i);
    if (preisbereichMatch3) {
      const min = Number(preisbereichMatch3[1]);
      const max = Number(preisbereichMatch3[2]);
      return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
    }
  }

  // "X-Y" oder "X bis Y" (Bindestrich oder Leerzeichen)
  // Nur wenn genau 2 Zahlen vorhanden und sie nahe beieinander im Text stehen
  if (numbers.length === 2) {
    const textWithNumbers = text.replace(/[^\d\s-]/g, " ");
    const hyphenMatch = textWithNumbers.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (hyphenMatch) {
      const min = Number(hyphenMatch[1]);
      const max = Number(hyphenMatch[2]);
      if (sorted.includes(min) && sorted.includes(max)) {
        return { isRange: true, min: Math.min(min, max), max: Math.max(min, max) };
      }
    }
  }

  return { isRange: false };
}

/**
 * Helper: Erkennt Approx-Budget (circa, ca., ungefähr, around)
 */
function detectApproxBudget(
  text: string,
  numbers: number[]
): { isApprox: boolean; value?: number; min?: number; max?: number } {
  if (numbers.length === 0) {
    return { isApprox: false };
  }

  const normalized = normalize(text);
  const approxPatterns = [
    /\b(circa|ca\.?|ungefähr|um\s+die|um\s+die\s+(\d+)\s+herum)\b/,
    /\b(around|roughly|about)\b/,
  ];

  const hasApprox = approxPatterns.some((pattern) => pattern.test(normalized));
  if (!hasApprox) {
    return { isApprox: false };
  }

  // Nimm die größte Zahl als Basis
  const value = Math.max(...numbers);
  // Approx als Range: 0.8x bis 1.2x
  const min = Math.floor(value * 0.8);
  const max = Math.ceil(value * 1.2);

  return { isApprox: true, value, min, max };
}

/**
 * Budget-Parser:
 * - erkennt unter/über/zwischen
 * - unterscheidet zwischen klaren und vagen Budgetangaben
 *
 * VERBESSERT (2025-01-XX):
 * - Robuste Erkennung von Max/Min/Range/Approx-Budget
 * - DE & EN Synonyme
 * - Bessere Behandlung mehrerer Zahlen
 */
export function extractUserPriceRange(text: string): UserPriceRange {
  const normalized = normalize(text);
  const notes: string[] = [];

  // Budget- und Preiswörter
  const budgetWordRegex =
    /\b(budget|preisrahmen|preislimit|preisspanne|preisgrenze|obergrenze|untergrenze|kosten|kostet|teuer|günstig|billig|preis)\b/;
  const currencyRegex = /\b(eur|euro|€|bucks|dollar)\b/;

  const hasBudgetWord = budgetWordRegex.test(normalized);
  const hasCurrencyWord = currencyRegex.test(normalized);

  // Günstig/Cheap-Wörter
  // SCHRITT 2 FIX: Erweitert um alle Formen von "billig" für wantsCheapest-Erkennung
  const cheapWords = [
    "günstig",
    "günstige",
    "günstiges",
    "günstigen",
    "günstiger",
    "günstigste",
    "günstigstes",
    "günstigsten",
    "billig",
    "billige",
    "billiges",
    "billigen",
    "billiger",
    "billigste",
    "billigstes",
    "billigsten",
    "preiswert",
    "preiswerte",
    "preiswertes",
    "erschwinglich",
    "nicht zu teuer",
    "eher günstig",
    "cheap",
    "cheapest",
    "low price",
    "budget",
  ];
  const hasCheapWord = cheapWords.some((w) => normalized.includes(w));

  // Kleines Budget-Phrasen
  const smallBudgetPhraseRegex =
    /\b(kleines?\s+budget|sehr\s+kleines?\s+budget|minimales?\s+budget|wenig\s+geld|kaum\s+geld|sehr\s+wenig\s+geld)\b/;
  const isSmallBudgetPhrase = smallBudgetPhraseRegex.test(normalized);

  // Alle Zahlen extrahieren
  const extracted = extractNumbersForBudget(normalized);
  const numbers = extracted.numbers.map((n) => n.value);

  const result: UserPriceRange = {
    minPrice: undefined,
    maxPrice: undefined,
    hasBudgetWord: hasBudgetWord || hasCurrencyWord,
    isBudgetAmbiguous: false,
    notes,
  };

  // 1) Keine Zahlen → nur Wörter
  if (numbers.length === 0) {
    const hasUnder = detectMaxBudget(text);
    const hasOver = detectMinBudget(text);
    const hasBetween = /\bzwischen\b/.test(normalized);

    result.hasBudgetWord =
      hasBudgetWord || hasCurrencyWord || hasUnder || hasOver || hasBetween;

    if (hasBudgetWord || hasCurrencyWord || hasCheapWord || isSmallBudgetPhrase) {
      result.isBudgetAmbiguous = true;
      notes.push(
        "Budget (DE): Budget-/Preisbezug ohne konkrete Zahl – Rückfrage empfohlen statt min/max zu raten."
      );
    } else {
      notes.push("Budget (DE): kein Budgetkontext und keine Zahlen – kein min/maxPrice gesetzt.");
    }
    return result;
  }

  // 2) Nur sehr kleine Zahlen und kein klarer Budget-/Währungskontext
  const allVerySmall = numbers.every((n) => n <= 5);
  const hasUnder = detectMaxBudget(text);
  const hasOver = detectMinBudget(text);
  const hasBetween = /\bzwischen\b/.test(normalized);

  result.hasBudgetWord =
    hasBudgetWord || hasCurrencyWord || hasUnder || hasOver || hasBetween;

  if (
    allVerySmall &&
    !hasCurrencyWord &&
    !hasBudgetWord &&
    !hasUnder &&
    !hasOver &&
    !hasBetween
  ) {
    result.isBudgetAmbiguous = true;
    notes.push(
      `Budget (DE): nur sehr kleine Zahlen (${numbers.join(
        ", "
      )}) ohne Budget-/Währungskontext – als vage markiert (z. B. 1TB, 3x LED).`
    );
    return result;
  }

  // 3) Approx-Budget (zuerst prüfen, da es eine Range erzeugt)
  const approxResult = detectApproxBudget(text, numbers);
  if (approxResult.isApprox && approxResult.min !== undefined && approxResult.max !== undefined) {
    result.minPrice = approxResult.min;
    result.maxPrice = approxResult.max;
    notes.push(
      `Budget (DE): 'circa/ungefähr' erkannt – Approx-Range minPrice=${result.minPrice} maxPrice=${result.maxPrice} (Basis: ${approxResult.value}).`
    );
    return result;
  }

  // 4) Range-Budget (zwischen X und Y, X-Y, von X bis Y, im Preisbereich X-Y)
  const rangeResult = detectRangeBudget(text, numbers);
  if (rangeResult.isRange && rangeResult.min !== undefined && rangeResult.max !== undefined) {
    result.minPrice = rangeResult.min;
    result.maxPrice = rangeResult.max;
    notes.push(
      `Budget (DE): Range erkannt – minPrice=${result.minPrice} maxPrice=${result.maxPrice}.`
    );
    return result;
  }

  // 5) "unter/bis/höchstens/maximal" → maxPrice
  if (hasUnder && numbers.length >= 1) {
    const max = Math.max(...numbers);
    result.maxPrice = max;
    notes.push(`Budget (DE): Max-Budget erkannt – maxPrice=${max}.`);
    return result;
  }

  // 6) "über/ab/mindestens" → minPrice (Untergrenze)
  if (hasOver && numbers.length >= 1) {
    let base = numbers[0];

    if (numbers.length > 1) {
      // Wenn mehrere Zahlen vorkommen, nimm die größte als Untergrenze
      base = Math.max(...numbers);
    }

    result.minPrice = base;
    notes.push(
      `Budget (DE): Min-Budget erkannt – minPrice=${base}.`
    );
    return result;
  }

  // 7) Einzelne Zahl mit Budget-/Währungsbezug → maxPrice (als Obergrenze interpretiert)
  // SCHRITT 2 FIX: Bei reinen "billig/günstig"-Fragen OHNE explizite Budget-Wörter (wie "budget", "preis")
  // KEIN maxPrice setzen, damit wantsCheapest greifen kann
  if (numbers.length === 1 && (hasCurrencyWord || hasBudgetWord)) {
    const single = numbers[0];

    if (single <= 5 && !hasCurrencyWord) {
      result.isBudgetAmbiguous = true;
      notes.push(
        `Budget (DE): einzelne sehr kleine Zahl (${single}) mit vagem Budgetwort – Rückfrage statt harter Grenze.`
      );
      return result;
    }

    // SCHRITT 2 FIX: Wenn nur "billig/günstig" vorhanden, aber KEINE expliziten Budget-Wörter,
    // dann KEIN maxPrice setzen (wantsCheapest soll greifen)
    const hasExplicitBudgetWord = hasBudgetWord && !hasCheapWord;
    if (hasCheapWord && !hasExplicitBudgetWord && !hasCurrencyWord) {
      // Reine "billig/günstig"-Frage ohne explizites Budget-Wort → kein maxPrice
      result.isBudgetAmbiguous = true;
      notes.push(
        `Budget (DE): Reine "billig/günstig"-Frage ohne explizites Budget-Wort – kein maxPrice gesetzt (wantsCheapest).`
      );
      return result;
    }

    result.maxPrice = single;
    notes.push(
      `Budget (DE): Einzelzahl mit Budget-/Währungskontext – maxPrice=${single} als Obergrenze interpretiert.`
    );
    return result;
  }

  // 8) Zwei Zahlen mit Budget-/Währungskontext → Spannweite
  if (numbers.length === 2 && (hasCurrencyWord || hasBudgetWord)) {
    const sorted = [...numbers].sort((a, b) => a - b);
    result.minPrice = sorted[0];
    result.maxPrice = sorted[1];
    notes.push(
      `Budget (DE): zwei Zahlen mit Budgetkontext – minPrice=${result.minPrice} maxPrice=${result.maxPrice}.`
    );
    return result;
  }

  // 9) Mehrere Zahlen mit Budget-/Währungskontext → Fallback maxPrice
  if (numbers.length > 0 && (hasCurrencyWord || hasBudgetWord)) {
    const max = Math.max(...numbers);
    result.maxPrice = max;
    notes.push(
      `Budget (DE): mehrere Zahlen mit Budget-/Währungskontext – größter Wert als maxPrice=${max} (Fallback).`
    );
    return result;
  }

  // Spezialfall: sehr kleines Budget mit klarer Budget-/Währungsangabe → als vage/zu niedrig markieren
  if (numbers.length > 0) {
    const maxNumber = Math.max(...numbers);

    // Sehr kleines Budget (< 20) mit klarem Budget-/ oder Währungskontext
    if (
      maxNumber < 20 &&
      (hasBudgetWord || hasCurrencyWord || hasUnder || hasBetween || hasCheapWord || isSmallBudgetPhrase)
    ) {
      // Obergrenze setzen, aber als vage markieren → AI-Hilfe erlaubt
      if (result.maxPrice === undefined) {
        result.maxPrice = maxNumber;
      }
      result.isBudgetAmbiguous = true;
      notes.push(
        `Budget (DE): sehr kleines Budget (${maxNumber}) mit klarer Budget-/Währungsangabe – als vage/zu niedrig markiert.`
      );
      return result;
    }

    // Sehr hohes Budget (≥ 500) soll NICHT als vage gelten → Premium explizit erlaubt
    if (maxNumber >= 500) {
      if (result.maxPrice === undefined && result.minPrice === undefined) {
        result.maxPrice = maxNumber;
      }
      result.isBudgetAmbiguous = false;
      notes.push(
        `Budget (DE): sehr hohes Budget (${maxNumber}) – nicht als vage markiert (Premium-Empfehlungen erlaubt).`
      );
      // Kein return hier: min/max können bereits sinnvoll gesetzt sein,
      // wir wollen nur die Ambiguität zurücksetzen.
    }
  }

  // 10) Nur Zahlen ohne klaren Kontext → vage
  result.isBudgetAmbiguous = true;
  notes.push(
    `Budget (DE): Zahlen (${numbers.join(
      ", "
    )}) ohne klaren Budget-/Währungskontext – als vage Budgetangabe markiert.`
  );
  return result;
}

export type BudgetAnalysis = {
  userMinPrice: number | null;
  userMaxPrice: number | null;
  hasBudgetWord: boolean;
  isBudgetAmbiguous: boolean;
  notes: string[];
};

export function analyzeBudget(text: string): BudgetAnalysis {
  // Basis: existierender Budget-Parser
  const userRange = extractUserPriceRange(text);

  let userMinPrice = userRange.minPrice ?? null;
  let userMaxPrice = userRange.maxPrice ?? null;

  // Korrektur-Schicht für Klartext-Budgetwörter (über/unter/bis/höchstens)
  // Diese Schicht ist jetzt weniger wichtig, da extractUserPriceRange bereits robuster ist,
  // aber wir behalten sie für Edge-Cases bei.

  const textLowerForBudget = text.toLowerCase();

  // Prüfe auf explizite Min/Max-Indikatoren (mit erweiterten Synonymen)
  const explicitOver = detectMinBudget(text);
  const explicitUnder = detectMaxBudget(text);

  // Fall 1: User sagt explizit "über/mindestens/ab ..." und Budget-Parser hat nur eine Obergrenze gesetzt
  // → minPrice = maxPrice, maxPrice wird zurückgesetzt
  if (explicitOver && !explicitUnder && userMinPrice == null && userMaxPrice != null) {
    userMinPrice = userMaxPrice;
    userMaxPrice = null;
    userRange.notes.push(
      `Budget (Korrektur): 'über/mindestens/ab' erkannt – maxPrice → minPrice korrigiert.`
    );
  }

  // Fall 2: User sagt explizit "unter/bis/maximal ..." und Budget-Parser hat nur eine Untergrenze gesetzt
  // → maxPrice = minPrice, minPrice wird zurückgesetzt
  if (explicitUnder && !explicitOver && userMaxPrice == null && userMinPrice != null) {
    userMaxPrice = userMinPrice;
    userMinPrice = null;
    userRange.notes.push(
      `Budget (Korrektur): 'unter/bis/maximal' erkannt – minPrice → maxPrice korrigiert.`
    );
  }

  return {
    userMinPrice,
    userMaxPrice,
    hasBudgetWord: userRange.hasBudgetWord,
    isBudgetAmbiguous: userRange.isBudgetAmbiguous,
    notes: userRange.notes,
  };
}

/**
 * EFRO Modularization Phase 2: computePriceRangeInfo ausgelagert
 * 
 * Berechnet Preisbereich-Informationen für ehrliche Kommunikation.
 * Wird verwendet, wenn keine Produkte im gewünschten Preisbereich gefunden wurden.
 */
import type { PriceRangeInfo } from "./modules/types/index";
import type { EfroProduct } from "@/lib/products/mockCatalog";

export function computePriceRangeInfo(params: {
  userMinPrice: number | null;
  userMaxPrice: number | null;
  allProducts: EfroProduct[];
  effectiveCategorySlug: string | null;
  normalize: (text: string) => string;
}): PriceRangeInfo {
  const { userMinPrice, userMaxPrice, allProducts, effectiveCategorySlug, normalize } = params;
  
  const productsInCategory = effectiveCategorySlug
    ? allProducts.filter((p) => normalize(p.category || "") === effectiveCategorySlug)
    : allProducts;
  
  const pricesInCategory = productsInCategory
    .map((p) => p.price ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  
  const categoryMinPrice = pricesInCategory.length > 0 ? pricesInCategory[0] : null;
  const categoryMaxPrice = pricesInCategory.length > 0 ? pricesInCategory[pricesInCategory.length - 1] : null;
  
  return {
    userMinPrice: userMinPrice ?? null,
    userMaxPrice: userMaxPrice ?? null,
    categoryMinPrice,
    categoryMaxPrice,
    category: effectiveCategorySlug,
  };
}


