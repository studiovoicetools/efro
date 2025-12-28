// src/lib/sales/brain/steps/16_decision.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep16_DecisionFlow(context: SellerBrainContext): Promise<void> {
  context.flags = context.flags || {};

  let route: "ai" | "rule" | "clarify" | "block" | "invalid" = "rule";

  if (context.flags.invalidInput) {
    route = "invalid";
  } else if (context.policyViolations?.length) {
    route = "block";
  } else if (context.flags.needsClarification) {
    route = "clarify";
  } else if (context.flags.needsAIReply) {
    route = "ai";
  }

  context.routing = route;

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "decision",
      routing: route,
    });
  }
}
