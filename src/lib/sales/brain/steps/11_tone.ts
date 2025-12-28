// src/lib/sales/brain/steps/11_tone.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep11_ToneDetection(context: SellerBrainContext): Promise<void> {
  const text = context.inputText?.toLowerCase() || "";

  let tone: "neutral" | "friendly" | "angry" | "sarcastic" | "unclear" = "neutral";

  if (/danke|bitte|könntest du|wäre nett/.test(text)) {
    tone = "friendly";
  } else if (/was soll der mist|warum geht das nicht|nervt|kotzt mich an/.test(text)) {
    tone = "angry";
  } else if (/na klar|toll gemacht|super idee/.test(text)) {
    tone = "sarcastic";
  } else if (text.length < 3 || !/[a-z]/.test(text)) {
    tone = "unclear";
  }

  context.tone = tone;

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "tone",
        detected: tone,
      });
    } else {
      context.debug = [
        {
          step: "tone",
          detected: tone,
        },
      ];
    }
  }
}
