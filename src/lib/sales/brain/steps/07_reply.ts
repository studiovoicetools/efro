// src/lib/sales/brain/steps/07_reply.ts

import { SellerBrainContext } from "../../types";
import { buildReplyText } from "./08_reply";

export async function runStep07_ReplyGeneration(context: SellerBrainContext): Promise<void> {
  if (
    !context.intent ||
    !context.inputText ||
    !Array.isArray(context.recommendedProducts)
  ) {
    return;
  }

  context.replyText = buildReplyText(
    context.inputText,
    context.intent,
    context.recommendedProducts,
    undefined,
    false,
    undefined,
    undefined,
    context.replyMode,
    context.storeFacts
  );

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "reply",
        replyText: context.replyText,
      });
    } else {
      context.debug = [
        {
          step: "reply",
          replyText: context.replyText,
        },
      ];
    }
  }
}
