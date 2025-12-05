// Zentrale Typen für SellerBrain

import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";

/**
 * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
 */
export interface SellerBrainContext {
  activeCategorySlug?: string | null;
}

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
 * Ergebnisstruktur des Seller-Gehirns
 */
export type SellerBrainResult = {
  intent: ShoppingIntent;
  recommended: EfroProduct[];
  replyText: string;
  nextContext?: SellerBrainContext;
  /** Meta-Infos, wann eine AI-Hilfe sinnvoll wäre */
  aiTrigger?: SellerBrainAiTrigger;
  /** EFRO Budget-Fix 2025-11-30: Flag, wenn keine Produkte im gewünschten Preisbereich gefunden wurden */
  priceRangeNoMatch?: boolean;
  /** EFRO Budget-Fix 2025-11-30: Preisbereich-Informationen für ehrliche Kommunikation */
  priceRangeInfo?: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  };
  /** EFRO Budget-Fix 2025-11-30: Fehlende Kategorie-Hinweis (z. B. "Bindungen" nicht im Katalog) */
  missingCategoryHint?: string;
  /** EFRO Explanation-Mode: true, wenn der User eine Erklärung anfordert */
  explanationMode?: boolean;
  /** EFRO WAX-Fix: Debug-Flags für fehlende Beschreibungen etc. */
  debugFlags?: {
    missingDescription?: boolean;
  };
};

export type ProductHint = {
  keyword: string;
  categoryHint?: string;
  attributes?: string[];
  weight?: number;
};

/**
 * Optionen für runSellerBrainV2
 */
export interface RunSellerBrainV2Options {
  shopDomain: string; // z.B. 'test-shop.myshopify.com' oder 'demo'
  locale?: string; // default 'de'
  useCache?: boolean; // default true
}

/**
 * Ergebnis von runSellerBrainV2 (erweitert SellerBrainResult um Cache-Flag)
 */
export interface SellerBrainV2Result extends SellerBrainResult {
  fromCache?: boolean;
}

