// src/lib/sales/brain/steps/22_telemetry.ts

import { SellerBrainContext } from "../../types";

export async function runStep22_Telemetry(context: SellerBrainContext): Promise<void> {
  if (!context.result) {
    context.result = {};
  }

  const productQualityCounts = (
    context.result as { productQuality?: { counts?: Record<string, number> } }
  ).productQuality?.counts;

  const counts = {
    eligible: productQualityCounts?.eligible ?? 0,
    softBad: productQualityCounts?.softBad ?? 0,
    strictBad: productQualityCounts?.strictBad ?? 0,
  };

  (context.result as { telemetry?: Record<string, unknown> }).telemetry = {
    flags: context.flags ?? {},
    routing: context.routing ?? null,
    tone: context.tone ?? null,
    summary: context.summary ?? "",
    counts,
    intent: context.intent ?? null,
    inputLength: context.inputText?.length ?? 0,
    timestamp: new Date().toISOString(),
  };

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "telemetry",
      summary: "Exported telemetry fields",
    });
  }
}
