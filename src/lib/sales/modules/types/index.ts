// src/lib/sales/modules/types/index.ts
// EFRO Modularization Phase 2: Typen ausgelagert

import { EfroProduct } from "@/lib/products/mockCatalog";
import { ShoppingIntent } from "@/lib/products/mockCatalog";
import type { SalesPolicyOutput } from "@/lib/sales/salesTypes";

/**
 * Preisbereich-Informationen für ehrliche Kommunikation
 * EFRO Budget-Fix 2025-11-30: Preisbereich-Informationen für ehrliche Kommunikation
 */
export type PriceRangeInfo = {
  userMinPrice: number | null;
  userMaxPrice: number | null;
  categoryMinPrice: number | null;
  categoryMaxPrice: number | null;
  category?: string | null;
  /** EFRO Budget-Optimierung: Preis des günstigsten Produkts knapp über Budget (falls vorhanden) */
  nearestPriceAboveBudget?: number | null;
  /** EFRO Budget-Optimierung: Titel des günstigsten Produkts knapp über Budget (falls vorhanden) */
  nearestProductTitleAboveBudget?: string | null;
};

/**
 * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
 */
export interface SellerBrainContext {
  activeCategorySlug?: string | null;
  /** Dynamische Aliase, die vom AI-Resolver gelernt wurden (z. B. "gesichtscreen" -> "gesichtscreme") */
  dynamicAliases?: Record<string, string>;
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
  aiTrigger?: {
    needsAiHelp: boolean;
    reason?: string;
    unknownTerms?: string[];
    codeTerm?: string;
    unknownProductCodes?: string[];
    queryForAi?: string;
    context?: {
      matchedProducts?: Array<{ id: string; title: string; category?: string }>;
      productDescription?: string;
    };
    termExplainRequests?: Array<{
      term: string;
      purpose: "category_guess" | "semantic_help";
    }>;
  };
  /** EFRO Budget-Fix 2025-11-30: Flag, wenn keine Produkte im gewünschten Preisbereich gefunden wurden */
  priceRangeNoMatch?: boolean;
  /** EFRO Budget-Fix 2025-11-30: Preisbereich-Informationen für ehrliche Kommunikation */
  priceRangeInfo?: PriceRangeInfo;
  /** EFRO Budget-Fix 2025-11-30: Fehlende Kategorie-Hinweis (z. B. "Bindungen" nicht im Katalog) */
  missingCategoryHint?: string;
  /** EFRO Explanation-Mode: true, wenn der User eine Erklärung anfordert */
  explanationMode?: boolean;
  /** EFRO WAX-Fix: Debug-Flags für fehlende Beschreibungen etc. */
  debugFlags?: {
    missingDescription?: boolean;
  };
  /** EFRO Sales-Entscheidungsschicht: Sales-Policy-Output */
  sales?: SalesPolicyOutput;
};
