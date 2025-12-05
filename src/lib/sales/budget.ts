/**
 * EFRO Budget-Modul
 *
 * WICHTIG:
 * - Dieses Modul wird aktuell von sellerBrain.ts noch NICHT verwendet.
 * - Es ändert daher NICHT das Verhalten deiner aktuellen Tests.
 * - Ziel ist, Budget-Logik später aus sellerBrain.ts hierher umzuziehen.
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
 * Budget-Parser:
 * - erkennt unter/über/zwischen
 * - unterscheidet zwischen klaren und vagen Budgetangaben
 *
 * HINWEIS:
 * Diese Version ist eine gut lesbare Grundlage.
 * Wir werden sie später anhand der 88 Szenarien gezielt nachschärfen.
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

  const hasUnder =
    /\b(unter|bis\s+max(?:imal)?|bis\s+höchstens|nicht\s+mehr\s+als|max(?:imal)?)\b/.test(
      normalized
    );
  const hasOver = /\b(über|ueber|uber|mindestens|ab)\b/.test(normalized);
  const hasBetween = /\bzwischen\b/.test(normalized);

  const cheapWordRegex =
    /\b(günstig|billig|preiswert|erschwinglich|nicht\s+zu\s+teuer|eher\s+günstig)\b/;
  const hasCheapWord = cheapWordRegex.test(normalized);

  const smallBudgetPhraseRegex =
    /\b(kleines?\s+budget|sehr\s+kleines?\s+budget|minimales?\s+budget|wenig\s+geld|kaum\s+geld|sehr\s+wenig\s+geld)\b/;
  const isSmallBudgetPhrase = smallBudgetPhraseRegex.test(normalized);

  // Alle Zahlen extrahieren
  const extracted = extractNumbersForBudget(normalized);
  const numbers = extracted.numbers.map((n) => n.value);

  const result: UserPriceRange = {
    minPrice: undefined,
    maxPrice: undefined,
    hasBudgetWord: hasBudgetWord || hasCurrencyWord || hasUnder || hasOver || hasBetween,
    isBudgetAmbiguous: false,
    notes,
  };

  // 1) Keine Zahlen → nur Wörter
  if (numbers.length === 0) {
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

  // 3) "zwischen X und Y"
  if (hasBetween && numbers.length >= 2) {
    const sorted = [...numbers].sort((a, b) => a - b);
    result.minPrice = sorted[0];
    result.maxPrice = sorted[sorted.length - 1];
    notes.push(
      `Budget (DE): 'zwischen' erkannt – minPrice=${result.minPrice} maxPrice=${result.maxPrice}.`
    );
    return result;
  }

  // 4) "unter/bis/höchstens" → maxPrice
  if (hasUnder && numbers.length >= 1) {
    const max = Math.max(...numbers);
    result.maxPrice = max;
    notes.push(`Budget (DE): 'unter/bis/höchstens' erkannt – maxPrice=${max}.`);
    return result;
  }

  // 5) "über/ab/mindestens" → minPrice (Untergrenze)
  if (hasOver && numbers.length >= 1) {
    let base = numbers[0];

    if (numbers.length > 1) {
      // Wenn mehrere Zahlen vorkommen, nimm die größte als Untergrenze
      base = Math.max(...numbers);
    }

    result.minPrice = base;
    notes.push(
      `Budget (DE): 'über/ab/mindestens' erkannt – minPrice=${base}.`
    );
    return result;
  }

  // 6) Einzelne Zahl mit Budget-/Währungsbezug → maxPrice
  if (numbers.length === 1 && (hasCurrencyWord || hasBudgetWord)) {
    const single = numbers[0];

    if (single <= 5 && !hasCurrencyWord) {
      result.isBudgetAmbiguous = true;
      notes.push(
        `Budget (DE): einzelne sehr kleine Zahl (${single}) mit vagem Budgetwort – Rückfrage statt harter Grenze.`
      );
      return result;
    }

    result.maxPrice = single;
    notes.push(
      `Budget (DE): Einzelzahl mit Budget-/Währungskontext – maxPrice=${single} als Obergrenze interpretiert.`
    );
    return result;
  }

  // 7) Zwei Zahlen mit Budget-/Währungskontext → Spannweite
  if (numbers.length === 2 && (hasCurrencyWord || hasBudgetWord)) {
    const sorted = [...numbers].sort((a, b) => a - b);
    result.minPrice = sorted[0];
    result.maxPrice = sorted[1];
    notes.push(
      `Budget (DE): zwei Zahlen mit Budgetkontext – minPrice=${result.minPrice} maxPrice=${result.maxPrice}.`
    );
    return result;
  }

  // 8) Mehrere Zahlen mit Budget-/Währungskontext → Fallback maxPrice
  if (numbers.length > 0 && (hasCurrencyWord || hasBudgetWord)) {
    const max = Math.max(...numbers);
    result.maxPrice = max;
    notes.push(
      `Budget (DE): mehrere Zahlen mit Budget-/Währungskontext – größter Wert als maxPrice=${max} (Fallback).`
    );
    return result;
  }

  // 9) Nur Zahlen ohne klaren Kontext → vage
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
  const textLowerForBudget = text.toLowerCase();

  const explicitOver =
    /\b(über|ueber|uber)\b/.test(textLowerForBudget);
  const explicitUnder =
    /\b(unter|bis|höchstens|hochstens|hoechstens|max(?:imal)?)\b/.test(
      textLowerForBudget
    );

  // Fall 1: User sagt explizit "über ..." und Budget-Parser hat nur eine Obergrenze gesetzt
  // → minPrice = maxPrice, maxPrice wird zurückgesetzt
  if (explicitOver && !explicitUnder && userMinPrice == null && userMaxPrice != null) {
    userMinPrice = userMaxPrice;
    userMaxPrice = null;
  }

  // Fall 2: User sagt explizit "unter/bis ..." und Budget-Parser hat nur eine Untergrenze gesetzt
  // → maxPrice = minPrice, minPrice wird zurückgesetzt
  if (explicitUnder && !explicitOver && userMaxPrice == null && userMinPrice != null) {
    userMaxPrice = userMinPrice;
    userMinPrice = null;
  }

  return {
    userMinPrice,
    userMaxPrice,
    hasBudgetWord: userRange.hasBudgetWord,
    isBudgetAmbiguous: userRange.isBudgetAmbiguous,
    notes: userRange.notes,
  };
}


