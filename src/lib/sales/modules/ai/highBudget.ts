// src/lib/sales/modules/ai/highBudget.ts

/**
 * Prüft, ob für eine Unknown-Term-Situation (low_confidence_unknown_terms)
 * bei einer sehr hohen reinen Budget-Anfrage KEIN AI-Trigger gesetzt werden soll.
 *
 * Beispiel J1: "Ich habe 10000 Euro zur Verfügung."
 * - isBudgetOnly = true
 * - userMaxPrice = 10000
 * - finalCount > 0 (es gibt passende Produkte)
 * → Dann soll SellerBrain OHNE AI auskommen.
 */
export function shouldSkipLowConfidenceForHighBudget(params: {
  isBudgetOnly: boolean;
  userMinPrice?: number | null;
  userMaxPrice?: number | null;
  finalCount: number;
}): boolean {
  const { isBudgetOnly, userMinPrice, userMaxPrice, finalCount } = params;

  // Ohne Produkte oder ohne Budget-Werte gibt es keinen Grund für diesen Spezial-Case
  if (finalCount <= 0) return false;

  const hasUserBudget =
    (typeof userMinPrice === "number" && !Number.isNaN(userMinPrice)) ||
    (typeof userMaxPrice === "number" && !Number.isNaN(userMaxPrice));

  if (!isBudgetOnly || !hasUserBudget) {
    return false;
  }

  // Schwelle für "sehr hohes Budget" – hier bewusst konservativ auf 1000 € gesetzt.
  const HIGH_BUDGET_THRESHOLD = 1000;

  if (
    typeof userMaxPrice === "number" &&
    !Number.isNaN(userMaxPrice) &&
    userMaxPrice >= HIGH_BUDGET_THRESHOLD
  ) {
    // Sehr hohe Budget-Only-Query mit vorhandenen Empfehlungen:
    // → KEIN AI-Trigger durch low_confidence_unknown_terms
    return true;
  }

  return false;
}
