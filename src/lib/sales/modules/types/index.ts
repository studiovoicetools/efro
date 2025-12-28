// src/lib/sales/modules/types/index.ts
// EFRO Modularization Phase 2: Typen ausgelagert

import { EfroProduct } from "@/lib/products/mockCatalog";
import { ShoppingIntent } from "@/lib/products/mockCatalog";
import type { SalesPolicyOutput } from "@/lib/sales/salesTypes";
import type { StoreFacts } from "../../kb/storeFacts";
import type { PolicyViolation } from "@/lib/sales/utils/checkPolicyViolations";

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

export type BudgetParseInfo = {
  hasEuroNumber: boolean;
  hasPriceRange: boolean;
  hasBudgetWord: boolean;
  hasBudgetPhrase: boolean;
  isBudgetPhraseDetected: boolean;
  reason: "priceOnly" | "none";
  value?: number | null;
  score?: number | null;
};

export type SellerBrainDebugEntry = {
  step: string;
  [key: string]: unknown;
};

export type ProductQuality = "eligible" | "soft-bad" | "strict-bad";

export type ProductQualityReport = {
  counts: { eligible: number; softBad: number; strictBad: number };
  reasons: Record<string, string[]>;
  examples: Record<string, string>;
};

/**
 * Kontext für SellerBrain (z. B. aktive Kategorie aus vorheriger Anfrage)
 */
export interface SellerBrainContext {
  storeFacts?: StoreFacts; // optional KB facts per shop

  activeCategorySlug?: string | null;
  /** Dynamische Aliase, die vom AI-Resolver gelernt wurden (z. B. "gesichtscreen" -> "gesichtscreme") */
  dynamicAliases?: Record<string, string>;
  /**
   * Steuert den Antwortmodus von SellerBrain:
   * - "customer": Antworten sind auf Endkunden ausgerichtet (du, Nutzen, keine Betreiber-Hinweise)
   * - "operator": Antworten dürfen interne Hinweise für den Shopbetreiber enthalten.
   * Standard ist "customer", wenn nicht gesetzt.
   */
  replyMode?: "customer" | "operator";
  /**
   * Optionale Shop-Domain (z.B. "demo-shop.myshopify.com"), wird u.a. für
   * Supabase-Alias-Lookups verwendet.
   */
  shopDomain?: string;
  /** Rohtext der aktuellen Anfrage (für Step-Parsing). */
  inputText?: string;
  /** Ergebnis der Regex-basierten Budget-Erkennung. */
  budgetParse?: BudgetParseInfo;
  /** Optionales Debug-Log pro Step. */
  debug?: SellerBrainDebugEntry[];
  /** Aktiviert Debug-Logs auf Steps. */
  debugMode?: boolean;
  /** Aktueller Intent (Input) für Intent-Extraction. */
  currentIntent?: ShoppingIntent;
  /** Extrahierter Intent (Output). */
  intent?: ShoppingIntent;
  /** Kategorie-Result der Kategorie-Erkennung. */
  category?: unknown;
  /** Produktkatalog für Kategorie-Erkennung. */
  catalog?: EfroProduct[];
  /** Optional: Tags oder Tokens der Anfrage. */
  tags?: string[];
  /** Optional: vorheriger Intent. */
  previousIntent?: ShoppingIntent;
  /** Optional: vorherige Kategorie. */
  previousCategory?: string | null;
  /** Optional: aktuelles Produkt (z. B. für Tag-Parsing). */
  product?: EfroProduct | null;
  /** Empfohlene Produkte für Reply-Generation. */
  recommendedProducts?: Array<EfroProduct & { quality?: ProductQuality }>;
  /** Antworttext aus Reply-Generation. */
  replyText?: string;
  /** Policy-Verstöße für empfohlene Produkte. */
  policyViolations?: PolicyViolation[];
  /** Kurz-Zusammenfassung fuer Logging/UI. */
  summary?: string;
  /** Routing-Entscheidung der Decision-Phase. */
  routing?: "ai" | "rule" | "clarify" | "block" | "invalid";
  /** Finaler Reply-Text nach Routing. */
  finalReply?: string;
  /** Finales Ergebnisobjekt für Konsum durch API/UI/Tests. */
  result?: Record<string, unknown> & {
    productQuality?: ProductQualityReport;
    debugContext?: Record<string, unknown>;
    telemetry?: Record<string, unknown>;
  };
  /** Optionaler Tonfall für Reply-Generierung. */
  tone?: string | null;
  /** Confidence-Score für Intent-Erkennung. */
  intentScore?: number | null;
  /** Confidence-Score für Kategorie-Erkennung. */
  categoryScore?: number | null;
  /** Flags für Ergebniszustand. */
  flags?: {
    needsClarification?: boolean;
    isFallback?: boolean;
    invalidInput?: boolean;
    needsAIReply?: boolean;
    guardrailViolation?: boolean;
    internalError?: boolean;
    languageIssue?: boolean;
    schemaViolation?: boolean;
  };
  /** Optionale Liste geprüfter Produkte. */
  products?: EfroProduct[];
  /** Performance-Messwerte. */
  performance?: {
    totalTime?: number | null;
  };
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
