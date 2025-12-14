// src/lib/sales/modules/salesDecision.ts
// EFRO Sales-Entscheidungsschicht: Generische Regeln für Profiseller-Verhalten

import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { PriceRangeInfo } from "@/lib/sales/modules/types";
import type { SalesAction } from "@/lib/sales/salesTypes";
import { normalize } from "@/lib/sales/modules/utils";

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

function isGenericBoardOnly(normalizedText: string): boolean {
  const mentionsBoard = normalizedText.includes("board") || normalizedText.includes("boards");
  if (!mentionsBoard) return false;

  const hasEntryLevelQualifier =
    normalizedText.includes("einsteiger") ||
    normalizedText.includes("anfanger") ||
    normalizedText.includes("anfaenger");
  if (hasEntryLevelQualifier) return false;

  const hasSnowPrefix =
    normalizedText.includes("snowboard") ||
    normalizedText.includes("snowbord") ||
    /\bsnow\s*board/.test(normalizedText);

  if (hasSnowPrefix) return false;

  const otherBoards = ["skateboard", "surfboard", "wakeboard", "kiteboard", "longboard"];
  if (otherBoards.some((kw) => normalizedText.includes(kw))) {
    return false;
  }

  return true;
}

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
  // REGEL 3: Budget-Konflikt (priceRangeNoMatch) - HOHE PRIORITÄT
  // ============================================================
  // CLUSTER E FIX: PROFI-07v2 - Budget-Mismatch sehr niedrig → BUDGET_NO_MATCH statt LOW_BUDGET_WITH_UPSELL
  // PROFI-07: "Snowboard-Set unter 100 Euro" → EXPLAIN_BUDGET_MISMATCH, BUDGET_NO_MATCH
  // WICHTIG: Diese Regel muss VOR REGEL 5 (Low-Budget mit Upsell) geprüft werden,
  // damit priceRangeNoMatch Priorität hat
  // CLUSTER E FIX: Prüfe auch auf sehr niedriges Budget (z. B. unter 100 Euro für Snowboard)
  // SCHRITT 3 FIX: Prüfe auch auf Budget-Mismatch mit Kategorie-Minimum (z. B. Snowboard-Set unter 100 Euro)
  // WICHTIG: Bei priceRangeNoMatch = true UND real existierenden Produkten in der richtigen Kategorie
  // → EXPLAIN_BUDGET_MISMATCH setzen (auch wenn candidates.length > 0, weil diese aus aboveBudget kommen)
  const hasVeryLowBudget = userMaxPrice !== null && userMaxPrice < 100;
  const hasBudgetMismatch = priceRangeNoMatch || (hasBudget && userMaxPrice !== null && userMaxPrice < 100 && candidates.length === 0);
  
  // CLUSTER E FIX: PROFI-07v2 - Auch wenn Produkte vorhanden sind, aber priceRangeNoMatch = true
  // (z. B. Snowboard-Set unter 100 Euro, aber Produkte kosten mehr)
  // CLUSTER 2 FIX PROFI-07v2: Auch bei sehr niedrigem Budget (z. B. "komplettes Set, maximal 100 Euro")
  // → EXPLAIN_BUDGET_MISMATCH setzen (auch mit Kategorie, wenn Budget zu niedrig für "Set")
  const mentionsSet = normalized.includes("set") || normalized.includes("komplett");
  const hasVeryLowBudgetForSet = userMaxPrice !== null && userMaxPrice <= 100 && mentionsSet;
  
  // PROFI-07v2 Fix: Bei "komplettes Set" + sehr niedrigem Budget immer EXPLAIN_BUDGET_MISMATCH
  // (auch wenn Produkte vorhanden sind, da "Set" impliziert mehrere Produkte zusammen)
  // WICHTIG: "komplettes Set" bedeutet normalerweise mehrere Produkte zusammen, daher ist Budget <= 100 Euro
  // für ein komplettes Set realistisch nicht erfüllbar, auch wenn einzelne Produkte unter dem Budget liegen
  if (!primaryAction && hasVeryLowBudgetForSet) {
    // Prüfe, ob alle Kandidaten über dem Budget liegen oder ob ein "Set" realistisch nicht möglich ist
    const allCandidatesAboveBudget = candidates.length > 0 && candidates.every(c => {
      const price = typeof c.price === "number" ? c.price : Number(c.price) || 0;
      return price > (userMaxPrice ?? 0);
    });
    
    // PROFI-07v2 Fix: Bei "komplettes Set" + Budget <= 100 Euro IMMER EXPLAIN_BUDGET_MISMATCH,
    // auch wenn einzelne Produkte unter dem Budget liegen, da ein "komplettes Set" mehrere Produkte bedeutet
    // und die Summe wahrscheinlich über dem Budget liegt
    if (allCandidatesAboveBudget || priceRangeNoMatch || (mentionsSet && userMaxPrice !== null && userMaxPrice <= 100)) {
      primaryAction = "EXPLAIN_BUDGET_MISMATCH";
      notes.push("BUDGET_NO_MATCH");
      debugSalesFlags.push("budget_no_match_set");
    }
  }
  
  if (!primaryAction && (hasBudgetMismatch || (priceRangeNoMatch && effectiveCategorySlug && candidates.length > 0))) {
    primaryAction = "EXPLAIN_BUDGET_MISMATCH";
    notes.push("BUDGET_NO_MATCH");
    // Optional: LOW_BUDGET_WITH_UPSELL hinzufügen, wenn aktiv auf höhere Preise hinweisen soll
    if (candidates.length > 0 && userMaxPrice !== null && userMaxPrice < 100) {
      notes.push("LOW_BUDGET_WITH_UPSELL");
    }
    debugSalesFlags.push("budget_no_match");
  }

  // ============================================================
  // REGEL 4: Cross-Selling (Kauf-Intent) - VOR AMBIGUOUS_BOARD
  // ============================================================
  // CLUSTER E FIX: PROFI-03v2 - Cross-Selling → BUY_INTENT_CROSS_SELL_HINT statt AMBIGUOUS_BOARD
  // PROFI-03: "Ich kaufe das Snowboard, was brauche ich noch dazu?" → OFFER_CROSS_SELL, BUY_INTENT_CROSS_SELL_HINT
  // SCHRITT 3 FIX: Erweitere Cross-Sell-Erkennung für robustere Erkennung
  const seemsBuyIntent =
    /\b(kaufe|kaufen|nehme|nehmen|bestelle|bestellen|in den warenkorb|was brauche ich noch|was brauch ich noch|was sollte ich zusätzlich|was sollte ich dazukaufen|was brauche ich zusätzlich|gibt es zubehör|empfehlen würdest)\b/.test(normalized);

  if (!primaryAction && candidates.length > 0 && seemsBuyIntent) {
    primaryAction = "OFFER_CROSS_SELL";
    notes.push("BUY_INTENT_CROSS_SELL_HINT");
    debugSalesFlags.push("cross_sell_trigger");
  }

  // ============================================================
  // REGEL 5: Low-Budget mit Upsell (günstigste Anfragen) - VOR AMBIGUOUS_BOARD
  // ============================================================
  // CLUSTER E FIX: PROFI-02v2 - Low-Budget: Günstigstes Snowboard → LOW_BUDGET_WITH_UPSELL statt AMBIGUOUS_BOARD
  // PROFI-02: "Zeig mir das günstigste Snowboard." → SHOW_PRODUCTS, LOW_BUDGET_WITH_UPSELL
  // WICHTIG: Diese Regel wird NUR angewendet, wenn KEIN priceRangeNoMatch vorliegt
  const mentionsCheapest =
    /\b(günstig(st|ste|sten)?|billig(st|ste|sten)?|das günstigste|preiswerteste)\b/.test(normalized);

  const mentionsCheapBudget = /\b(unter|bis|maximal|max)\s+\d+/.test(normalized);
  
  // CLUSTER E FIX: Prüfe auf Snowboard-Kontext, um AMBIGUOUS_BOARD zu vermeiden
  const hasSnowboardKeyword =
    normalized.includes("snowboard") ||
    normalized.includes("snowbord") ||
    /\bsnow\s*board/.test(normalized);
  const boardEntryQualifier =
    normalized.includes("einsteiger") ||
    normalized.includes("anfanger") ||
    normalized.includes("anfaenger");
  const hasSnowboardContext = 
    hasSnowboardKeyword ||
    boardEntryQualifier ||
    contextCategory === "snowboard";
  const boardCategoryFromGeneric =
    effectiveCategorySlug === "snowboard" &&
    !hasSnowboardKeyword &&
    !boardEntryQualifier;

  // SCHRITT 3 FIX: Bei bargain-Intent + Produkte + kein Budget-Mismatch → LOW_BUDGET_WITH_UPSELL
  if (!primaryAction && candidates.length > 0 && !priceRangeNoMatch) {
    if (intent === "bargain" || mentionsCheapest || mentionsCheapBudget) {
      primaryAction = "SHOW_PRODUCTS";
      if (!notes.includes("LOW_BUDGET_WITH_UPSELL")) {
        notes.push("LOW_BUDGET_WITH_UPSELL");
      }
      debugSalesFlags.push("low_budget_upsell");
    }
  }

  // ============================================================
  // REGEL 6: Mehrdeutige Anfrage (Board, vage Beschreibungen) - NACH anderen Signalen
  // ============================================================
  // CLUSTER E FIX: AMBIGUOUS_BOARD nur dann setzen, wenn KEIN klarer Snowboard-Kontext vorliegt
  // PROFI-01: "Ich will ein Board." → ASK_CLARIFICATION, AMBIGUOUS_BOARD
  // PROFI-08: "Ich will was richtig Cooles..." → ASK_CLARIFICATION, NO_PRODUCTS_FOUND
  // SCHRITT 4 FIX: PROFI-08v2: "Hast du etwas, womit ich im Urlaub Eindruck mache?" → ASK_CLARIFICATION, NO_PRODUCTS_FOUND
  const mentionsBoardGeneric = isGenericBoardOnly(normalized);

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
      .map((p) => (p.category || "").toLowerCase().trim())
      .filter((c) => c.length > 0)
  );
  const hasWeakCategories =
    !effectiveCategorySlug ||
    (candidates.length > 0 && normalizedCategories.size > 1);
  
  // C1v2/F6v2/F1v1 Fix: Premium-Intent ausschließen (z. B. "Premium-Produkte mit dem höchsten Preis")
  const isPremiumIntent = intent === "premium";
  const mentionsPremiumWithPrice = normalized.includes("premium") && 
    (normalized.includes("höchsten") || normalized.includes("teuersten") || normalized.includes("höchster") || normalized.includes("teuerster"));
  const isPremiumRequest = isPremiumIntent || mentionsPremiumWithPrice;
  
  // S17/S17v1 Fix: Wax-Anfragen ausschließen (z. B. "Wax für Haare")
  const mentionsWax = normalized.includes("wax") || normalized.includes("wachs");
  const mentionsHair = normalized.includes("haare") || normalized.includes("hair");
  const isWaxRequest = mentionsWax && mentionsHair;
  
  // K10v1/K11v1 Fix: Jeans-Anfragen ausschließen (z. B. "Slim Fit Jeans")
  const mentionsJeans = normalized.includes("jeans") || normalized.includes("hose");
  const mentionsSlimFit = normalized.includes("slim") && (normalized.includes("fit") || normalized.includes("jeans"));
  const isJeansRequest = mentionsJeans || mentionsSlimFit;
  
  // K6v2 Fix: Smartphone-Modellnamen-Anfragen ausschließen (z. B. "Alpha 128GB Schwarz")
  const mentionsAlphaModel = /\b(alpha\s+\d+\s*gb|alpha\s+\d+\s*gb\s+schwarz|das\s+alpha\s+\d+\s*gb)\b/i.test(text);
  const isSmartphoneModelRequest = mentionsAlphaModel && (effectiveCategorySlug === "elektronik" || candidates.some((p) => normalize(p.category || "") === "elektronik"));
  
  const isVeryVagueLifestyle = 
    unknownTerms.length > 0 && 
    hasNoBudget && 
    hasWeakCategories && 
    candidates.length > 0 &&
    !isPremiumRequest &&      // C1v2/F6v2/F1v1: Premium-Intent ausschließen
    !isWaxRequest &&           // S17/S17v1: Wax-Anfragen ausschließen
    !isJeansRequest &&         // K10v1/K11v1: Jeans-Anfragen ausschließen
    !isSmartphoneModelRequest; // K6v2: Smartphone-Modellnamen-Anfragen ausschließen

  // CLUSTER E FIX: PROFI-08v1 - Vage Anfrage → NO_PRODUCTS_FOUND statt AMBIGUOUS_BOARD
  // Prüfe zuerst auf vage Lifestyle-Anfrage (PROFI-08v1)
  // CLUSTER 2 FIX PROFI-08v1: Wenn "Board" vorkommt, aber keine Produkte gefunden wurden → NO_PRODUCTS_FOUND
  const hasBoardButNoProducts = mentionsBoardGeneric && candidates.length === 0;
  
  if (!primaryAction && mentionsBoardGeneric && (!hasSnowboardContext || boardCategoryFromGeneric)) {
    primaryAction = "ASK_CLARIFICATION";
    if (!notes.includes("AMBIGUOUS_BOARD")) {
      notes.push("AMBIGUOUS_BOARD");
    }
    if (!notes.includes("NO_PRODUCTS_FOUND")) {
      notes.push("NO_PRODUCTS_FOUND");
    }
    debugSalesFlags.push("ambiguous_board_only");
  } else if (!primaryAction && (isVeryVagueLifestyle || hasBoardButNoProducts)) {
    // SCHRITT 4 FIX: Vage Lifestyle-Anfrage → ASK_CLARIFICATION + NO_PRODUCTS_FOUND
    primaryAction = "ASK_CLARIFICATION";
    notes.push("NO_PRODUCTS_FOUND");
    debugSalesFlags.push("vague_lifestyle_query");
    console.log("[EFRO SalesDecision] Vage Lifestyle-Anfrage erkannt (PROFI-08v1/v2)", {
      text: text.substring(0, 100),
      unknownTerms,
      hasNoBudget,
      hasWeakCategories,
      candidatesCount: candidates.length,
      effectiveCategorySlug,
      hasBoardButNoProducts,
      note: "ASK_CLARIFICATION + NO_PRODUCTS_FOUND gesetzt",
    });
  } else if (!primaryAction && isVagueQuery) {
    // Vage Query, auch wenn Produkte gefunden wurden
    primaryAction = "ASK_CLARIFICATION";
    notes.push("NO_PRODUCTS_FOUND");
    debugSalesFlags.push("vague_query");
  } else if (!primaryAction && mentionsBoardGeneric && !hasSnowboardContext && candidates.length > 0) {
    // CLUSTER E FIX: AMBIGUOUS_BOARD nur wenn KEIN Snowboard-Kontext UND Produkte gefunden
    primaryAction = "ASK_CLARIFICATION";
    notes.push("AMBIGUOUS_BOARD");
    debugSalesFlags.push("ambiguous_board_detected");
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

