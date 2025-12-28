// src/lib/sales/brain/steps/18_return.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep18_FinalReturn(context: SellerBrainContext): Promise<any> {
  const result: Record<string, unknown> = {
    replyText: context.finalReply,
    flags: context.flags || {},
    routing: context.routing || "unknown",
    summary: context.summary || "",
    result: context.result || {},
  };

  if (context.debugMode) {
    result.debug = context.debug || [];
    result.contextSnapshot = {
      inputText: context.inputText,
      intent: context.intent,
      category: context.category,
      budget: context.budgetParse?.value || null,
      tone: context.tone || null,
      needsAIReply: context.flags?.needsAIReply || false,
      needsClarification: context.flags?.needsClarification || false,
    };
  }

  return result;
}
