// src/lib/sales/brain/steps/25_validateOutput.ts

import { SellerBrainContext } from "../../types";

function markViolation(context: SellerBrainContext, issue: string): void {
  if (!context.flags) {
    context.flags = {};
  }
  context.flags.schemaViolation = true;

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "schemaValidation",
      issue,
    });
  }
}

export async function runStep25_ValidateOutput(context: SellerBrainContext): Promise<void> {
  const result = context.result;

  if (!result || typeof result !== "object") {
    markViolation(context, "Missing result object");
  }

  const finalReply = context.finalReply;
  if (typeof finalReply !== "string" || finalReply.trim().length === 0) {
    markViolation(context, "Missing finalReply");
  }

  const summary = context.summary;
  if (typeof summary !== "string" || summary.trim().length === 0) {
    markViolation(context, "Missing summary");
  }

  const routing = context.routing;
  const routingIsString = typeof routing === "string";
  const routingIsObjectWithMode =
    routing &&
    typeof routing === "object" &&
    typeof (routing as { mode?: unknown }).mode === "string";
  if (!routingIsString && !routingIsObjectWithMode) {
    markViolation(context, "Missing routing");
  }
}
