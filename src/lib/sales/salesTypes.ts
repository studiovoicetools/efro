// src/lib/sales/salesTypes.ts
// EFRO Sales-Brain Typen (Grundlage für zukünftiges Sales-Brain-System)
// Nur Typen und Interfaces, keine Logik

import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import { PriceRangeInfo } from "@/lib/sales/modules/types";

/**
 * Mögliche Sales-Aktionen, die das Sales-Brain auswählen kann
 */
export type SalesAction =
  | "SHOW_PRODUCTS"
  | "ASK_CLARIFICATION"
  | "OFFER_UPSELL"
  | "OFFER_CROSS_SELL"
  | "EXPLAIN_BUDGET_MISMATCH"
  | "SHOW_DELIVERY_INFO"
  | "SHOW_RETURNS_INFO"
  | "HANDLE_OBJECTION"
  | "CTA_ADD_TO_CART";

/**
 * Call-to-Action Typen für UI-Interaktionen
 */
export type CtaType = "ADD_TO_CART" | "SHOW_DETAILS" | "CONTINUE_QUESTION" | "NONE";

/**
 * Kern-Ergebnisstruktur des Engine-Outputs (komprimiert für Sales-Policy)
 */
export interface EngineResultCore {
  intent: ShoppingIntent;                // aus mockCatalog / sellerBrain
  products: EfroProduct[];               // aktuelle Produktliste
  contextCategory?: string | null;
  effectiveCategorySlug?: string | null;
  userMinPrice?: number | null;
  userMaxPrice?: number | null;
  priceRangeInfo?: PriceRangeInfo | null;
  priceRangeNoMatch?: boolean;
  debugFlags?: string[];
}

/**
 * Eingabe für die Sales-Policy-Entscheidung
 */
export interface SalesPolicyInput {
  text: string;                     // User-Query
  engine: EngineResultCore;         // komprimierter Engine-Output
  conversationId?: string;          // für späteren Kontext
  locale?: string;                  // "de" | "en" etc.
}

/**
 * Ausgabe der Sales-Policy-Entscheidung
 */
export interface SalesPolicyOutput {
  primaryAction: SalesAction;
  cta: CtaType;
  crossSellProducts: EfroProduct[];
  upsellProducts: EfroProduct[];
  clarificationQuestion?: string | null;
  objectionHandled?: boolean;
  notes?: string[];                 // Debug / Logging / Tests
}

/**
 * Finales Ergebnis von runSellerBrain (inkl. Sales-Brain-Ausgabe)
 * Dies ist die Form, in der runSellerBrain am Ende antworten soll
 */
export interface SellerBrainFinalResult {
  products: EfroProduct[];
  intent: ShoppingIntent;
  contextCategory?: string | null;
  effectiveCategorySlug?: string | null;
  userMinPrice?: number | null;
  userMaxPrice?: number | null;
  priceRangeInfo?: PriceRangeInfo | null;
  priceRangeNoMatch?: boolean;
  debugFlags?: string[];
  sales: SalesPolicyOutput;      // NEU: SalesBrain-Ausgabe
}

