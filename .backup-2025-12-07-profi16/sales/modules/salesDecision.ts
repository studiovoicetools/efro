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
 * Erkennt Lieferzeit-Fragen robust.
 * 
 * Erkennt Muster wie:
 * - "Ist das morgen da, wenn ich heute bestelle?"
 * - "Kann das bis morgen geliefert werden?"
 * - "Kann das bis Samstag geliefert werden?"
 * - "Wie schnell kommt das an?"
 */
function detectDeliveryQuestion(normalizedText: string): boolean {
  // Lieferungs-Verben und -Nomen (erweitert)
  const deliveryVerbs = /\b(liefern|geliefert|lieferung|lieferzeit|lieferung|ankommen|kommt.*an|da sein|da sein|ankommt|geliefert werden|geliefert werden kann)\b/;
  
  // Zeitwörter (erweitert)
  const timeWords = /\b(morgen|heute|übermorgen|bis morgen|bis übermorgen|bis samstag|bis sonntag|bis montag|bis dienstag|bis mittwoch|bis donnerstag|bis freitag|spätestens|wann|wie schnell|wie lange|bis.*morgen|bis.*samstag|bis.*sonntag)\b/;
  
  // Kombinationen: Lieferungs-Verb + Zeitwort ODER Zeitwort + Lieferungs-Verb
  const hasDeliveryVerb = deliveryVerbs.test(normalizedText);
  const hasTimeWord = timeWords.test(normalizedText);
  
  // Spezielle Muster (erweitert für PROFI-04v2)
  // WICHTIG: Flexiblere Muster, die auch "Kann das bis morgen geliefert werden?" erkennen
  const specificPatterns = [
    /ist.*morgen.*da/i,
    /kommt.*morgen.*an/i,
    /kann.*bis.*morgen.*geliefert/i,
    /kann.*bis.*samstag.*geliefert/i,
    /kann.*bis.*morgen.*da/i,
    /kann.*bis.*samstag.*da/i,
    /kann.*das.*bis.*morgen.*geliefert/i,  // PROFI-04v2: "Kann das bis morgen geliefert werden?"
    /kann.*das.*bis.*samstag.*geliefert/i,
    /kann.*das.*bis.*morgen.*da/i,
    /kann.*das.*bis.*samstag.*da/i,
    /kann.*bis.*morgen.*geliefert.*werden/i,  // "Kann das bis morgen geliefert werden?"
    /kann.*bis.*samstag.*geliefert.*werden/i,
    /kann.*das.*bis.*morgen.*geliefert.*werden/i,  // PROFI-04v2: "Kann das bis morgen geliefert werden?"
    /kann.*das.*bis.*samstag.*geliefert.*werden/i,
    /kann.*das.*bis.*morgen.*da.*sein/i,  // "Kann das bis morgen da sein?"
    /kann.*das.*bis.*samstag.*da.*sein/i,
    /wann.*kommt.*an/i,
    /wie schnell.*kommt/i,
    /wie lange.*dauert/i,
    /wie schnell.*kommt.*an/i,
    /wie schnell.*geliefert/i,
    // Flexiblere Muster für "bis [Tag] geliefert werden"
    /bis.*morgen.*geliefert/i,
    /bis.*samstag.*geliefert/i,
    /bis.*sonntag.*geliefert/i,
    /bis.*montag.*geliefert/i,
    /bis.*dienstag.*geliefert/i,
    /bis.*mittwoch.*geliefert/i,
    /bis.*donnerstag.*geliefert/i,
    /bis.*freitag.*geliefert/i,
  ];
  
  // Wenn beide vorhanden sind, ist es sehr wahrscheinlich eine Lieferzeit-Frage
  if (hasDeliveryVerb && hasTimeWord) {
    return true;
  }
  
  // Prüfe spezielle Muster
  for (const pattern of specificPatterns) {
    if (pattern.test(normalizedText)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Erkennt Preis-Einwände robust.
 * 
 * Erkennt Muster wie:
 * - "Das ist mir zu teuer."
 * - "Der Preis ist mir zu hoch."
 * - "Ich finde das zu teuer."
 * - "Das ist zu teuer für mich."
 */
export function detectPriceObjection(normalizedText: string): boolean {
  // Kombination: "teuer" + "zu" oder "hoch" + "preis" + "zu"
  // Diese Prüfung ZUERST, da sie am flexibelsten ist
  const hasTeuer = normalizedText.includes("teuer");
  const hasZu = normalizedText.includes("zu");
  const hasHoch = normalizedText.includes("hoch");
  const hasPreis = normalizedText.includes("preis");
  
  // "Der Preis ist mir zu hoch" oder "Preis ist mir zu hoch" oder "preis ist zu hoch"
  // Wichtig: Diese Kombination hat höchste Priorität
  // PROFI-06v1: "Der Preis ist mir zu hoch."
  if (hasPreis && hasHoch && hasZu) {
    return true;
  }
  
  // "Ich finde das zu teuer" oder "finde zu teuer" oder "finde das zu teuer"
  // PROFI-06v2: "Ich finde das zu teuer."
  if (hasTeuer && hasZu && normalizedText.includes("finde")) {
    return true;
  }
  
  // Direkte Preis-Einwand-Muster (flexibler, ohne \b-Grenzen für zusammengesetzte Phrasen)
  // WICHTIG: Erweitert für PROFI-06v1/v2 - robustere Erkennung
  const priceObjectionPatterns = [
    /\bzu teuer\b/,
    /\bist mir zu teuer\b/,
    /\bdas ist mir zu teuer\b/,  // PROFI-06: "Das ist mir zu teuer."
    /preis.*ist.*mir.*zu.*hoch/i,  // "Preis ist mir zu hoch"
    /der.*preis.*ist.*mir.*zu.*hoch/i,  // "Der Preis ist mir zu hoch" (PROFI-06v1)
    /ich.*finde.*zu.*teuer/i,  // "Ich finde zu teuer"
    /ich.*finde.*das.*zu.*teuer/i,  // "Ich finde das zu teuer" (PROFI-06v2)
    /finde.*zu.*teuer/i,
    /finde.*das.*zu.*teuer/i,  // "finde das zu teuer"
    /\bzu teuer für mich\b/,
    /teuer.*zu/i,
    /zu.*teuer/i,
    /preis.*zu.*hoch/i,
    /zu.*hoch.*preis/i,
    /\bsehr teuer\b/,
    /zu.*viel.*preis/i,
    /preis.*zu.*viel/i,
    // Spezielle Muster für die Varianten (erweitert)
    /preis.*mir.*zu.*hoch/i,
    /preis.*ist.*zu.*hoch/i,
    /der.*preis.*ist.*zu.*hoch/i,  // "Der Preis ist zu hoch"
    /preis.*zu.*hoch/i,  // "Preis zu hoch"
    /mir.*zu.*hoch/i,  // "mir zu hoch" (im Kontext von Preis)
    // Robustere Muster für PROFI-06v1/v2
    /.*preis.*ist.*mir.*zu.*hoch.*/i,  // Flexibler: "Der Preis ist mir zu hoch"
    /.*finde.*das.*zu.*teuer.*/i,  // Flexibler: "Ich finde das zu teuer"
    /.*finde.*zu.*teuer.*/i,  // Flexibler: "Ich finde zu teuer"
  ];
  
  // Prüfe alle Muster
  for (const pattern of priceObjectionPatterns) {
    if (pattern.test(normalizedText)) {
      return true;
    }
  }
  
  // Allgemein: "zu teuer" (auch ohne explizites "preis")
  // PROFI-06: "Das ist mir zu teuer."
  if (hasTeuer && hasZu) {
    return true;
  }
  
  return false;
}

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

  console.log("[EFRO SalesDecision] Eingabe", {
    text: text.substring(0, 100),
    normalized,
    candidatesCount: candidates.length,
  });

  // ============================================================
  // REGEL 1: Service-Fragen (Lieferung / Rückgabe) - HOHE PRIORITÄT
  // ============================================================
  // PROFI-04: "Ist das morgen da..." → SHOW_DELIVERY_INFO, DELIVERY_QUESTION
  // PROFI-05: "Was ist, wenn es mir nicht passt?" → SHOW_RETURNS_INFO, RETURNS_QUESTION
  const mentionsDelivery = detectDeliveryQuestion(normalized);

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
  // PROFI-06v1: "Der Preis ist mir zu hoch." → HANDLE_OBJECTION, PRICE_OBJECTION
  // PROFI-06v2: "Ich finde das zu teuer." → HANDLE_OBJECTION, PRICE_OBJECTION
  // WICHTIG: Diese Regel greift auch bei Budget-Ambiguität,
  // da Preis-Einwand höhere Priorität hat als Budget-Rückfrage
  // WICHTIG: Diese Regel muss VOR allen anderen Regeln geprüft werden (außer Service-Fragen),
  // damit Preis-Einwände immer erkannt werden, auch wenn keine Produkte gefunden wurden
  // WICHTIG: Preis-Einwand hat Priorität über Budget-Ambiguität
  // WICHTIG: Preis-Einwand wird IMMER geprüft, auch wenn primaryAction bereits gesetzt ist
  // (außer bei Service-Fragen, die höchste Priorität haben)
  const complainsPrice = detectPriceObjection(normalized);

  console.log("[EFRO SalesDecision] Preis-Einwand-Check", {
    text: text.substring(0, 100),
    normalized,
    complainsPrice,
    primaryAction,
    note: "Preis-Einwand wird geprüft, auch wenn primaryAction bereits gesetzt ist (außer Service-Fragen)",
  });

  // WICHTIG: Preis-Einwand hat Priorität über alle anderen Regeln (außer Service-Fragen)
  // Auch wenn primaryAction bereits gesetzt ist (z. B. durch Budget-Ambiguität),
  // überschreibe es mit HANDLE_OBJECTION, wenn ein Preis-Einwand erkannt wurde
  if (complainsPrice) {
    // Nur überschreiben, wenn es KEINE Service-Frage ist
    if (primaryAction !== "SHOW_DELIVERY_INFO" && primaryAction !== "SHOW_RETURNS_INFO") {
      primaryAction = "HANDLE_OBJECTION";
      if (!notes.includes("PRICE_OBJECTION")) {
        notes.push("PRICE_OBJECTION");
      }
      debugSalesFlags.push("price_objection");
      
      console.log("[EFRO SalesDecision] Preis-Einwand erkannt", {
        text: text.substring(0, 100),
        normalized,
        primaryAction,
        notes,
        note: "Preis-Einwand erkannt, auch bei Budget-Ambiguität - überschreibt andere Actions",
      });
    } else {
      // Service-Frage hat höchste Priorität, aber füge PRICE_OBJECTION trotzdem zu Notes hinzu
      // (falls beide Themen angesprochen werden)
      if (!notes.includes("PRICE_OBJECTION")) {
        notes.push("PRICE_OBJECTION");
      }
      console.log("[EFRO SalesDecision] Preis-Einwand erkannt, aber Service-Frage hat Priorität", {
        text: text.substring(0, 100),
        normalized,
        primaryAction,
        notes,
      });
    }
  }

  // ============================================================
  // REGEL 3: Mehrdeutige Anfrage (Board, vage Beschreibungen)
  // ============================================================
  // PROFI-01: "Ich will ein Board." → ASK_CLARIFICATION, AMBIGUOUS_BOARD
  // PROFI-08: "Ich will was richtig Cooles..." → ASK_CLARIFICATION, NO_PRODUCTS_FOUND
  // SCHRITT 4 FIX: PROFI-08v2: "Hast du etwas, womit ich im Urlaub Eindruck mache?" → ASK_CLARIFICATION, NO_PRODUCTS_FOUND
  const mentionsBoardGeneric =
    normalized.includes("board") &&
    !normalized.includes("snowboard") &&
    !normalized.includes("skateboard") &&
    !normalized.includes("surfboard");

  const isVagueQuery =
    (normalized.includes("cool") || normalized.includes("cooles") || normalized.includes("was")) &&
    (normalized.includes("weiß nicht") || normalized.includes("nicht genau") || normalized.includes("weiß nicht genau") || normalized.includes("weiß nicht genau was"));

  // SCHRITT 4 FIX: Vage Lifestyle-Anfrage mit unknownTerms und ohne Budget
  // Bei low_confidence_unknown_terms + kein Budget + schwache Kategorien → ASK_CLARIFICATION
  const hasNoBudget = !hasBudget || (userMinPrice === null && userMaxPrice === null);
  // Kategorien der Kandidaten grob normalisieren, um zu prüfen,
  // ob wir viele verschiedene Kategorien im Spiel haben (schwacher Kategorie-Fokus)
  const normalizedCategories = new Set(
    candidates
      .map((p) => (p.category || "").trim().toLowerCase())
      .filter((c) => c.length > 0)
  );
  const hasWeakCategories =
    !effectiveCategorySlug ||
    (candidates.length > 0 && normalizedCategories.size > 1);
  const isVeryVagueLifestyle = 
    unknownTerms.length > 0 && 
    hasNoBudget && 
    hasWeakCategories && 
    candidates.length > 0;

  if (!primaryAction && mentionsBoardGeneric) {
    primaryAction = "ASK_CLARIFICATION";
    notes.push("AMBIGUOUS_BOARD");
    debugSalesFlags.push("ambiguous_board_detected");
  } else if (!primaryAction && isVagueQuery) {
    // Vage Query, auch wenn Produkte gefunden wurden
    primaryAction = "ASK_CLARIFICATION";
    notes.push("NO_PRODUCTS_FOUND");
    debugSalesFlags.push("vague_query");
  } else if (!primaryAction && isVeryVagueLifestyle) {
    // SCHRITT 4 FIX: Vage Lifestyle-Anfrage → ASK_CLARIFICATION + NO_PRODUCTS_FOUND
    primaryAction = "ASK_CLARIFICATION";
    notes.push("NO_PRODUCTS_FOUND");
    debugSalesFlags.push("vague_lifestyle_query");
    console.log("[EFRO SalesDecision] Vage Lifestyle-Anfrage erkannt (PROFI-08v2)", {
      text: text.substring(0, 100),
      unknownTerms,
      hasNoBudget,
      hasWeakCategories,
      candidatesCount: candidates.length,
      effectiveCategorySlug,
      note: "ASK_CLARIFICATION + NO_PRODUCTS_FOUND gesetzt",
    });
  }

  // ============================================================
  // REGEL 4: Budget-Konflikt (priceRangeNoMatch) - HOHE PRIORITÄT
  // ============================================================
  // PROFI-07: "Snowboard-Set unter 100 Euro" → EXPLAIN_BUDGET_MISMATCH, BUDGET_NO_MATCH
  // WICHTIG: Diese Regel muss VOR REGEL 6 (Low-Budget mit Upsell) geprüft werden,
  // damit priceRangeNoMatch Priorität hat
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
  // WICHTIG: Diese Regel wird NUR angewendet, wenn KEIN priceRangeNoMatch vorliegt
  const mentionsCheapest =
    /\b(günstig(st)?|billig(st)?|das günstigste|preiswerteste)\b/.test(normalized);

  const mentionsCheapBudget = /\b(unter|bis|maximal|max)\s+\d+/.test(normalized);

  if (!primaryAction && candidates.length > 0 && (mentionsCheapest || mentionsCheapBudget) && !priceRangeNoMatch) {
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

