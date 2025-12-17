// Zentrale Typen fÃ¼r SellerBrain

import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { StoreFacts } from "./kb/storeFacts";

/**
 * Kontext fÃ¼r SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
 */
export interface SellerBrainContext {
  storeFacts?: StoreFacts; // optional KB facts per shop

  activeCategorySlug?: string | null;
}

/**
 * AI-Trigger: Signal, wann SellerBrain zusÃ¤tzliche AI-Hilfe gebrauchen kÃ¶nnte
 */
export interface SellerBrainAiTrigger {
  /** true, wenn SellerBrain zusÃ¤tzliche AI-Hilfe gebrauchen kÃ¶nnte */
  needsAiHelp: boolean;
  /** KurzbegrÃ¼ndung, warum AI sinnvoll wÃ¤re */
  reason?: string;
  /** Begriffe, die bisher nicht gut aufgelÃ¶st wurden */
  unknownTerms?: string[];
  /** Erkannter Produktcode wie "ABC123" */
  codeTerm?: string;
  /** Unbekannte Produktcodes (z. B. ["XY-9000"]) */
  unknownProductCodes?: string[];
  /** Original-Query fÃ¼r AI (z. B. fÃ¼r ErklÃ¤rungen) */
  queryForAi?: string;
  /** Kontext fÃ¼r AI (z. B. matchedProducts fÃ¼r ErklÃ¤rungen) */
  context?: {
    matchedProducts?: Array<{ id: string; title: string; category?: string }>;
    /** EFRO WAX-Fix: Produktbeschreibung fÃ¼r AI-Zusammenfassung */
    productDescription?: string;
  };
  /** EFRO Fressnapf-Fix: Strukturierte Anfragen fÃ¼r unbekannte Begriffe */
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
  /** Meta-Infos, wann eine AI-Hilfe sinnvoll wÃ¤re */
  aiTrigger?: SellerBrainAiTrigger;
  /** EFRO Budget-Fix 2025-11-30: Flag, wenn keine Produkte im gewÃ¼nschten Preisbereich gefunden wurden */
  priceRangeNoMatch?: boolean;
  /** EFRO Budget-Fix 2025-11-30: Preisbereich-Informationen fÃ¼r ehrliche Kommunikation */
  priceRangeInfo?: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  };
  /** EFRO Budget-Fix 2025-11-30: Fehlende Kategorie-Hinweis (z. B. "Bindungen" nicht im Katalog) */
  missingCategoryHint?: string;
  /** EFRO Explanation-Mode: true, wenn der User eine ErklÃ¤rung anfordert */
  explanationMode?: boolean;
  /** EFRO WAX-Fix: Debug-Flags fÃ¼r fehlende Beschreibungen etc. */
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
 * Optionen fÃ¼r runSellerBrainV2
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




