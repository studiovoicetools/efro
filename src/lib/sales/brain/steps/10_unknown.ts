// src/lib/sales/brain/steps/10_unknown.ts

import { SellerBrainContext } from "../../types";

export async function runStep10_UnknownDetection(context: SellerBrainContext): Promise<void> {
  const noIntent = !context.intent;
  const noCategory = !context.category;
  const noBudget = !context.budgetParse?.value;
  const noRecommendations = !context.recommendedProducts || context.recommendedProducts.length === 0;

  const isUnknown = noIntent && noCategory && noBudget && noRecommendations;

  context.flags = {
    ...(context.flags || {}),
    needsClarification: isUnknown,
  };

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "unknown",
        reason: isUnknown
          ? "no-intent/no-category/no-budget/no-recommendations"
          : "pass",
      });
    } else {
      context.debug = [
        {
          step: "unknown",
          reason: isUnknown
            ? "no-intent/no-category/no-budget/no-recommendations"
            : "pass",
        },
      ];
    }
  }
}
