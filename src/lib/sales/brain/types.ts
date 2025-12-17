import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { SellerBrainContext, SellerBrainResult } from "@/lib/sales/modules/types";

export type ExplanationMode = "ingredients" | "materials" | "usage" | "care" | "washing";

export type BrainInput = {
  userText: string;
  currentIntent: ShoppingIntent;
  allProducts: EfroProduct[];
  plan?: string;
  previousRecommended?: EfroProduct[];
  context?: SellerBrainContext;
};

export type BrainOutput = SellerBrainResult;

export type BrainState = {
  nextIntent: ShoppingIntent;
  maxRecommendations: number;
  explanationMode: ExplanationMode | null;
  explanationModeBoolean: boolean;
  previousRecommendedCount: number;
};

export type LogPayload = Record<string, unknown>;

export type { LanguageRule } from "../types";
