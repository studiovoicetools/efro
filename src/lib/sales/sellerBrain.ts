// src/lib/sales/sellerBrain.ts

import type { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import type { SellerBrainContext, SellerBrainResult, PriceRangeInfo } from "@/lib/sales/modules/types";
import { runOrchestrator, runSellerBrainV2, productHints, staticProductHints } from "./brain/orchestrator";

export type { ProductHint, RunSellerBrainV2Options, SellerBrainV2Result } from "./brain/orchestrator";
export type { SellerBrainContext, SellerBrainResult, PriceRangeInfo };

export async function runSellerBrain(
  userText: string,
  currentIntent: ShoppingIntent,
  allProducts: EfroProduct[],
  plan?: string,
  previousRecommended?: EfroProduct[],
  context?: SellerBrainContext
): Promise<SellerBrainResult> {
  return runOrchestrator({
    userText,
    currentIntent,
    allProducts,
    plan,
    previousRecommended,
    context,
  });
}

export { runOrchestrator, runSellerBrainV2, productHints, staticProductHints };
