// src/lib/sales/brain/steps/23_selfTest.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

const ALLOWED_FLAG_KEYS = new Set([
  "needsClarification",
  "isFallback",
  "invalidInput",
  "needsAIReply",
  "guardrailViolation",
  "internalError",
]);

function logViolation(context: SellerBrainContext, error: string): void {
  if (!context.flags) {
    context.flags = {};
  }
  context.flags.internalError = true;

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "selfTest",
      error,
    });
  }
}

export async function runStep23_SelfTest(context: SellerBrainContext): Promise<void> {
  const result = context.result as
    | {
        finalReply?: unknown;
        flags?: unknown;
        productQuality?: { counts?: Record<string, number> };
      }
    | undefined;

  const finalReply = result?.finalReply;
  if (typeof finalReply !== "string" || finalReply.trim().length === 0) {
    logViolation(context, "Missing finalReply");
  }

  const flags = result?.flags;
  if (!flags || typeof flags !== "object") {
    logViolation(context, "Missing result.flags");
  } else {
    const invalidKeys = Object.keys(flags as Record<string, unknown>).filter(
      (key) => !ALLOWED_FLAG_KEYS.has(key)
    );
    if (invalidKeys.length > 0) {
      logViolation(context, `Invalid flag fields: ${invalidKeys.join(", ")}`);
    }
  }

  const counts = result?.productQuality?.counts;
  const total = counts?.total ?? 0;
  if (typeof total === "number" && total > 0) {
    const expectedTotal =
      (counts?.eligible ?? 0) + (counts?.softBad ?? 0) + (counts?.strictBad ?? 0);
    if (expectedTotal !== total) {
      logViolation(context, "Mismatch in product quality counts");
    }
  }
}
