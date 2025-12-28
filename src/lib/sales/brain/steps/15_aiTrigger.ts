// src/lib/sales/brain/steps/15_aiTrigger.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep15_DetectAIReplyTrigger(context: SellerBrainContext): Promise<void> {
  const noRecommendations = !context.recommendedProducts?.length;
  const unknownIntent = !context.intent;
  const unclearBudget = context.flags?.needsClarification;
  const policyBlocked = Boolean(context.policyViolations?.length);

  const needsAI = Boolean(unknownIntent || noRecommendations || unclearBudget || policyBlocked);

  context.flags = context.flags || {};
  context.flags.needsAIReply = needsAI;

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "aiTrigger",
      needsAI,
    });
  }
}
