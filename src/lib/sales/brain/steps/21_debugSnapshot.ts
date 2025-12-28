// src/lib/sales/brain/steps/21_debugSnapshot.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep21_DebugSnapshot(context: SellerBrainContext): Promise<void> {
  if (!context.debugMode) {
    return;
  }

  if (!context.result) {
    context.result = {};
  }

  const snapshot: Record<string, unknown> = {};
  const assignIfDefined = (key: string, value: unknown): void => {
    if (value !== undefined) {
      snapshot[key] = value;
    }
  };

  assignIfDefined("inputText", context.inputText);
  assignIfDefined("intent", context.intent);
  assignIfDefined("recommendedProducts", context.recommendedProducts);
  assignIfDefined("finalReply", context.finalReply);
  assignIfDefined("flags", context.flags);
  assignIfDefined("routing", context.routing);
  assignIfDefined("summary", context.summary);
  assignIfDefined("tone", context.tone);
  assignIfDefined("policyViolations", context.policyViolations);
  assignIfDefined("category", context.category);
  assignIfDefined("budgetParse", context.budgetParse);

  (context.result as { debugContext?: Record<string, unknown> }).debugContext = snapshot;

  if (!context.debug) {
    context.debug = [];
  }
  context.debug.push({
    step: "debugSnapshot",
    summary: "Context copied to result.debugContext",
  });
}
