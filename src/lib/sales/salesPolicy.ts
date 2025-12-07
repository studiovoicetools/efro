// src/lib/sales/salesPolicy.ts
// EFRO Sales-Policy: Profiseller-Policy mit SalesActions und Notes

import type { SalesPolicyInput, SalesPolicyOutput } from "@/lib/sales/salesTypes";
import { computeSalesDecision } from "@/lib/sales/modules/salesDecision";

export function applySalesPolicy(input: SalesPolicyInput): SalesPolicyOutput {
  // Nutze die generische Sales-Entscheidungsschicht
  const salesDecision = computeSalesDecision({
    text: input.text,
    intent: input.engine.intent,
    candidates: input.engine.products,
    unknownTerms: [], // Wird später aus aiTrigger geholt, falls verfügbar
    priceRangeInfo: input.engine.priceRangeInfo ?? undefined,
    priceRangeNoMatch: input.engine.priceRangeNoMatch ?? false,
    hasBudget: (input.engine.userMinPrice !== null && input.engine.userMinPrice !== undefined) ||
               (input.engine.userMaxPrice !== null && input.engine.userMaxPrice !== undefined),
    userMinPrice: input.engine.userMinPrice ?? null,
    userMaxPrice: input.engine.userMaxPrice ?? null,
    effectiveCategorySlug: input.engine.effectiveCategorySlug ?? null,
    contextCategory: input.engine.contextCategory ?? null,
  });

  // Mappe SalesDecisionOutput zu SalesPolicyOutput
  const primaryAction = salesDecision.primaryAction;
  const notes = salesDecision.salesNotes;

  // Bestimme CTA basierend auf primaryAction
  let cta: "ADD_TO_CART" | "SHOW_DETAILS" | "CONTINUE_QUESTION" | "NONE" = "NONE";
  if (primaryAction === "SHOW_PRODUCTS" && notes.includes("LOW_BUDGET_WITH_UPSELL")) {
    cta = "ADD_TO_CART";
  } else if (primaryAction === "ASK_CLARIFICATION" || primaryAction === "EXPLAIN_BUDGET_MISMATCH") {
    cta = "CONTINUE_QUESTION";
  } else if (primaryAction === "OFFER_CROSS_SELL") {
    cta = "ADD_TO_CART";
  }

  // Bestimme clarificationQuestion basierend auf primaryAction
  let clarificationQuestion: string | null = null;
  if (primaryAction === "ASK_CLARIFICATION" && notes.includes("AMBIGUOUS_BOARD")) {
    clarificationQuestion = "Meinst du ein Snowboard, ein Skateboard oder ein Surfboard? Dann kann ich dir gezielt etwas empfehlen.";
  } else if (primaryAction === "EXPLAIN_BUDGET_MISMATCH" && input.engine.userMaxPrice !== null) {
    clarificationQuestion = `In deinem Budget bis ca. ${input.engine.userMaxPrice} € ist aktuell nichts Passendes verfügbar. Darf ich dir auch Modelle leicht darüber zeigen?`;
  } else if (primaryAction === "ASK_CLARIFICATION" && notes.includes("NO_PRODUCTS_FOUND")) {
    clarificationQuestion = "Ich habe auf Anhieb nichts Passendes gefunden. Magst du genauer beschreiben, was du suchst (z. B. Marke, Größe, Einsatz)?";
  } else if (primaryAction === "HANDLE_OBJECTION") {
    clarificationQuestion = "Okay, der Preis ist dir wichtig. Soll ich dir günstigere Alternativen oder ein besseres Preis-Leistungs-Verhältnis zeigen?";
  }

  // Bestimme upsellProducts für LOW_BUDGET_WITH_UPSELL
  let upsellProducts: typeof input.engine.products = [];
  if (primaryAction === "SHOW_PRODUCTS" && notes.includes("LOW_BUDGET_WITH_UPSELL") && input.engine.products.length > 1) {
    const sortedByPrice = [...input.engine.products].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    upsellProducts = sortedByPrice.slice(1, 3);
  }

  return {
    primaryAction,
    cta,
    crossSellProducts: [],
    upsellProducts,
    clarificationQuestion,
    objectionHandled: primaryAction === "HANDLE_OBJECTION",
    notes,
  };
}

