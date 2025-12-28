// src/lib/sales/brain/steps/14_summary.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep14_Summary(context: SellerBrainContext): Promise<void> {
  const parts: string[] = [];

  if (context.intent) parts.push(`Intent: ${context.intent}`);
  if (context.category) parts.push(`Category: ${context.category}`);
  if (context.budgetParse?.value) parts.push(`Budget: ~${context.budgetParse.value} EUR`);
  if (context.recommendedProducts?.length)
    parts.push(`Recommendations: ${context.recommendedProducts.length} items`);
  if (context.tone) parts.push(`Tone: ${context.tone}`);
  if (context.flags?.needsClarification) parts.push(`Needs Clarification`);
  if (context.flags?.invalidInput) parts.push(`Invalid Input`);

  context.summary = parts.join(" | ");

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "summary",
      summary: context.summary,
    });
  }
}
