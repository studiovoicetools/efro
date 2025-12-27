// src/lib/sales/brain/steps/12_cleanup.ts

import { SellerBrainContext } from "../../types";

export async function runStep12_Cleanup(context: SellerBrainContext): Promise<void> {
  // Entferne volatile Felder, die downstream nicht gebraucht werden
  delete (context as any).currentIntent;

  if (!context.debugMode) {
    delete (context as any).debug;
  }

  // Optional: weitere temporäre Flags/Felder bereinigen
  delete (context as any).rawTags;
  delete (context as any).tagsText;

  // Falls context.result nicht existiert, fallback auf Basics
  if (!context.result) {
    context.result = {
      replyText: context.replyText || "",
      recommended: context.recommendedProducts || [],
      intent: context.intent || null,
      category: context.category || null,
    };
  }

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "cleanup",
      note: "volatile fields removed",
    });
  }
}
