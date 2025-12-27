// src/lib/sales/brain/steps/17_responseWriter.ts

import { SellerBrainContext } from "../../types";

export async function runStep17_WriteResponse(context: SellerBrainContext): Promise<void> {
  context.finalReply = "";

  switch (context.routing) {
    case "rule":
    case "ai":
      context.finalReply = context.replyText || "(empty)";
      break;
    case "clarify":
      context.finalReply = "Kannst du das bitte etwas genauer sagen? Ich habe es nicht ganz verstanden.";
      break;
    case "block":
      context.finalReply = "Leider kann ich dir dazu keine Vorschlaege machen.";
      break;
    case "invalid":
      context.finalReply = "Das sieht nach einem ungueltigen Eingabeformat aus.";
      break;
    default:
      context.finalReply = "(unbekannter Routing-Zweig)";
  }

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "responseWriter",
      routing: context.routing,
      output: context.finalReply,
    });
  }
}
