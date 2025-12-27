// src/lib/sales/brain/steps/03_budget.ts

import type { SellerBrainContext } from "@/lib/sales/modules/types";
import { BUDGET_MAX_WORDS } from "../../languageRules.de";

export async function runStep03_BudgetParsing(context: SellerBrainContext): Promise<void> {
  const text = context.inputText ?? "";

  const hasEuroNumber = /\b(\d+)\s*(euro|eur|€)\b/i.test(text);
  // CLUSTER 1 FIX S4v2: Erkenne auch "zwischen X und Y €" oder "X und Y Euro"
  const hasPriceRange =
    /\b(\d+)\s*(und|bis|-)\s*(\d+)\s*(euro|eur|€)\b/i.test(text) ||
    /\bzwischen\s+(\d+)\s+(und|bis|-)\s*(\d+)\s*(euro|eur|€)\b/i.test(text);
  // Importiert aus languageRules.de.ts - nutze BUDGET_MAX_WORDS für Budget-Wort-Erkennung
  const budgetWordsForRegex = ["budget", "preis", ...BUDGET_MAX_WORDS].join("|");
  const hasBudgetWord = new RegExp(`\\b(${budgetWordsForRegex})\\b`, "i").test(
    text.toLowerCase()
  );

  // EFRO Fix 2025-12-05: Budget-/Preis-Sätze auch ohne explizites Budgetwort
  // als produktbezogen werten, sobald eine konkrete Euro-Angabe vorhanden ist
  // (z. B. "Ich habe nur 20 Euro.", "Ich möchte über 100 Euro ausgeben.").
  // CLUSTER 1 FIX S4v2: Auch Preisbereiche wie "zwischen 600 und 900 €" erkennen
  // CLUSTER 2 FIX: Erkenne auch "ungefähr X €" oder "X € zur Verfügung" ohne explizites Budgetwort
  const hasBudgetPhrase =
    /\b(ungefähr|etwa|ca\.?|circa)\s*(\d+)\s*(euro|eur|€)\b/i.test(text) ||
    /\b(\d+)\s*(euro|eur|€)\s*(zur\s+verfügung|verfügbar|habe|hast)\b/i.test(text) ||
    /\b(habe|hast|hat)\s*(ungefähr|etwa|ca\.?|circa)?\s*(\d+)\s*(euro|eur|€)\b/i.test(text);

  const isBudgetPhraseDetected = hasEuroNumber || hasPriceRange || hasBudgetPhrase;
  const budgetParse = {
    hasEuroNumber,
    hasPriceRange,
    hasBudgetWord,
    hasBudgetPhrase,
    isBudgetPhraseDetected,
    reason: isBudgetPhraseDetected ? "priceOnly" : "none",
  };

  context.budgetParse = budgetParse;

  if (context.debug) {
    context.debug.push({ step: "budget", ...budgetParse });
  } else {
    context.debug = [{ step: "budget", ...budgetParse }];
  }
}
