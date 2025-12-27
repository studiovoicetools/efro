// src/lib/sales/brain/steps/04_intent.ts

import type { SellerBrainContext } from "@/lib/sales/modules/types";
import { extractIntent } from "../../intent/extractIntent";

export async function runStep04_IntentExtraction(context: SellerBrainContext): Promise<void> {
  if (context.inputText) {
    const currentIntent = context.currentIntent ?? "quick_buy";
    context.intent = extractIntent(context.inputText, currentIntent);

    if (context.debugMode) {
      if (context.debug) {
        context.debug.push({
          step: "intent",
          extractedIntent: context.intent,
        });
      } else {
        context.debug = [
          {
            step: "intent",
            extractedIntent: context.intent,
          },
        ];
      }
    }
  }
}
