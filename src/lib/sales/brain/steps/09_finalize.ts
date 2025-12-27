// src/lib/sales/brain/steps/09_finalize.ts

import { SellerBrainContext } from "../../types";

export async function runStep09_FinalizeOutput(context: SellerBrainContext): Promise<void> {
  context.result = {
    input: context.inputText,
    intent: context.intent,
    category: context.category,
    budget: context.budgetParse?.value,
    recommendations: context.recommendedProducts,
    reply: context.replyText,
    policyViolations: context.policyViolations ?? [],
    tone: context.tone ?? null,
    confidenceScores: {
      intent: context.intentScore ?? null,
      category: context.categoryScore ?? null,
      budget: context.budgetParse?.score ?? null,
    },
    flags: {
      needsClarification: context.flags?.needsClarification ?? false,
      isFallback: context.flags?.isFallback ?? false,
    },
    stepsExecuted: context.debug?.map((d) => d.step) ?? [],
    meta: {
      timestamp: new Date().toISOString(),
      productsChecked: context.products?.length ?? 0,
      executionTimeMs: context.performance?.totalTime ?? null,
    },
  };

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "finalize",
        summary: {
          resultKeys: Object.keys(context.result),
          recommendationCount: context.recommendedProducts?.length,
        },
      });
    } else {
      context.debug = [
        {
          step: "finalize",
          summary: {
            resultKeys: Object.keys(context.result),
            recommendationCount: context.recommendedProducts?.length,
          },
        },
      ];
    }
  }
}
