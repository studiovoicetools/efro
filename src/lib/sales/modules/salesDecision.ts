// src/lib/sales/modules/salesDecision.ts
// EFRO Sales-Entscheidungsschicht: Generische Regeln für Profiseller-Verhalten

import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { PriceRangeInfo } from "@/lib/sales/modules/types";
import type { SalesAction } from "@/lib/sales/salesTypes";

export type SalesDecisionInput = {
  text: string;
  intent: ShoppingIntent;
  candidates: EfroProduct[];
  unknownTerms?: string[];
  priceRangeInfo?: PriceRangeInfo;
  priceRangeNoMatch?: boolean;
  hasBudget: boolean;
  userMinPrice: number | null;
  userMaxPrice: number | null;
  effectiveCategorySlug?: string | null;
  contextCategory?: string | null;
};

export type SalesDecisionOutput = {
  primaryAction: SalesAction;
  salesNotes: string[];
  debugSalesFlags?: string[];
};

/**
 * Berechnet die Sales-Entscheidung basierend auf generischen Regeln.
 * 
 * Regeln basieren auf:
 * - Intent + Budget + Kandidaten + priceRangeInfo + UnknownTerms
 * - Keine Query-spezifischen Hacks
 * - Generische Muster (Ambiguität, Preis-Einwand, Budget-Konflikt, etc.)
 */
export function computeSalesDecision(
  input: SalesDecisionInput
): SalesDecisionOutput {
  const {
    text,
    intent,
    candidates,
    unknownTerms = [],
    priceRangeInfo,
    priceRangeNoMatch = false,
    hasBudget,
    userMinPrice,
    userMaxPrice,
    effectiveCategorySlug,
    contextCategory,
  } = input;

  const normalized = text.toLowerCase();
  const notes: string[] = [];
  const debugSalesFlags: string[] = [];

  let primaryAction: SalesAction | null = null;

  // ============================================================
  // REGEL 1: Service-Fragen (Lieferung / Rückgabe) - HOHE PRIORITÄT
  // ============================================================
  // PROFI-04: "Ist das morgen da..." → SHOW_DELIVERY_INFO, DELIVERY_QUESTION
  // PROFI-05: "Was ist, wenn es mir nicht passt?" → SHOW_RETURNS_INFO, RETURNS_QUESTION
  const mentionsDelivery =
    /\b(liefern|lieferung|ankommen|kommt.*an|morgen da|bis samstag|spätestens)\b/.test(normalized);

  const mentionsReturn =
    /\b(rückgabe|retoure|zurückschicken|umtausch|garantie|nicht passt|nicht gefällt|nicht gefallen|passt nicht|gefällt nicht)\b/.test(normalized) ||
    /was ist.*wenn.*nicht/.test(normalized) ||
    (normalized.includes("was ist") && normalized.includes("wenn") && (normalized.includes("nicht") || normalized.includes("passt"))) ||
    (normalized.includes("was ist") && normalized.includes("wenn") && normalized.includes("mir") && (normalized.includes("nicht") || normalized.includes("passt")));

  if (mentionsDelivery) {
    primaryAction = "SHOW_DELIVERY_INFO";
    notes.push("DELIVERY_QUESTION");
    debugSalesFlags.push("delivery_question");
  } else if (mentionsReturn) {
    primaryAction = "SHOW_RETURNS_INFO";
    notes.push("RETURNS_QUESTION");
    debugSalesFlags.push("returns_question");
  }

  // ============================================================
  // REGEL 2: Preis-Einwand - HOHE PRIORITÄT
  // ============================================================
  // PROFI-06: "Das ist mir zu teuer." → HANDLE_OBJECTION, PRICE_OBJECTION
  const complainsPrice =
    /\b(zu teuer|ist mir zu teuer|preis ist hoch|sehr teuer|zu teuer für mich)\b/.test(normalized) ||
    (normalized.includes("teuer") && (normalized.includes("zu") || normalized.includes("ist mir") || normalized.includes("mir zu")));

  if (!primaryAction && complainsPrice) {
    primaryAction = "HANDLE_OBJECTION";
    notes.push("PRICE_OBJECTION");
    debugSalesFlags.push("price_objection");
  }

  // ============================================================
  // REGEL 3: Mehrdeutige Anfrage (Board, vage Beschreibungen)
  // ============================================================
  // PROFI-01: "Ich will ein Board." → ASK_CLARIFICATION, AMBIGUOUS_BOARD
  // PROFI-08: "Ich will was richtig Cooles..." → ASK_CLARIFICATION, NO_PRODUCTS_FOUND
  const mentionsBoardGeneric =
    normalized.includes("board") &&
    !normalized.includes("snowboard") &&
    !normalized.includes("skateboard") &&
    !normalized.includes("surfboard");

  const isVagueQuery =
    (normalized.includes("cool") || normalized.includes("cooles") || normalized.includes("was")) &&
    (normalized.includes("weiß nicht") || normalized.includes("nicht genau") || normalized.includes("weiß nicht genau") || normalized.includes("weiß nicht genau was"));

  if (!primaryAction && mentionsBoardGeneric) {
    primaryAction = "ASK_CLARIFICATION";
    notes.push("AMBIGUOUS_BOARD");
    debugSalesFlags.push("ambiguous_board_detected");
  } else if (!primaryAction && isVagueQuery) {
    // Vage Query, auch wenn Produkte gefunden wurden
    primaryAction = "ASK_CLARIFICATION";
    notes.push("NO_PRODUCTS_FOUND");
    debugSalesFlags.push("vague_query");
  }

  // ============================================================
  // REGEL 4: Budget-Konflikt (priceRangeNoMatch)
  // ============================================================
  // PROFI-07: "Snowboard-Set unter 100 Euro" → EXPLAIN_BUDGET_MISMATCH, BUDGET_NO_MATCH
  if (!primaryAction && hasBudget && priceRangeNoMatch && userMaxPrice !== null) {
    primaryAction = "EXPLAIN_BUDGET_MISMATCH";
    notes.push("BUDGET_NO_MATCH");
    debugSalesFlags.push("budget_no_match");
  }

  // ============================================================
  // REGEL 5: Cross-Selling (Kauf-Intent)
  // ============================================================
  // PROFI-03: "Ich kaufe das Snowboard, was brauche ich noch dazu?" → OFFER_CROSS_SELL, BUY_INTENT_CROSS_SELL_HINT
  const seemsBuyIntent =
    /\b(kaufe|kaufen|nehme|nehmen|bestelle|bestellen|in den warenkorb|was brauche ich noch|was brauch ich noch)\b/.test(normalized);

  if (!primaryAction && candidates.length > 0 && seemsBuyIntent) {
    primaryAction = "OFFER_CROSS_SELL";
    notes.push("BUY_INTENT_CROSS_SELL_HINT");
    debugSalesFlags.push("cross_sell_trigger");
  }

  // ============================================================
  // REGEL 6: Low-Budget mit Upsell (günstigste Anfragen)
  // ============================================================
  // PROFI-02: "Zeig mir das günstigste Snowboard." → SHOW_PRODUCTS, LOW_BUDGET_WITH_UPSELL
  const mentionsCheapest =
    /\b(günstig(st)?|billig(st)?|das günstigste|preiswerteste)\b/.test(normalized);

  const mentionsCheapBudget = /\b(unter|bis|maximal|max)\s+\d+/.test(normalized);

  if (!primaryAction && candidates.length > 0 && (mentionsCheapest || mentionsCheapBudget)) {
    primaryAction = "SHOW_PRODUCTS";
    notes.push("LOW_BUDGET_WITH_UPSELL");
    debugSalesFlags.push("low_budget_upsell");
  }

  // ============================================================
  // REGEL 7: Normalfall – Produkte zeigen
  // ============================================================
  if (!primaryAction) {
    primaryAction = "SHOW_PRODUCTS";
    notes.push("DEFAULT_SHOW_PRODUCTS");
    debugSalesFlags.push("normal_recommendation");
  }

  return {
    primaryAction,
    salesNotes: notes,
    debugSalesFlags,
  };
}

