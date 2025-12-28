// src/lib/sales/brain/steps/24_languageGuard.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

const ENGLISH_KEYWORDS = [
  "free",
  "unknown",
  "description",
  "product",
  "products",
  "price",
  "cheap",
  "premium",
];

function scanText(
  text: string,
  field: string,
  issues: Array<{ field: string; issue: string }>
): void {
  const lower = text.toLowerCase();
  for (const keyword of ENGLISH_KEYWORDS) {
    if (lower.includes(keyword)) {
      issues.push({
        field,
        issue: `Found English word: ${keyword}`,
      });
    }
  }
}

export async function runStep24_LanguageGuard(context: SellerBrainContext): Promise<void> {
  const issues: Array<{ field: string; issue: string }> = [];
  const result = context.result as
    | {
        finalReply?: unknown;
        summary?: unknown;
        recommendations?: Array<{ title?: unknown; description?: unknown }>;
      }
    | undefined;

  const finalReply =
    typeof result?.finalReply === "string"
      ? result.finalReply
      : typeof context.finalReply === "string"
        ? context.finalReply
        : "";
  if (finalReply) {
    scanText(finalReply, "finalReply", issues);
  }

  const summary = typeof result?.summary === "string" ? result.summary : "";
  if (summary) {
    scanText(summary, "summary", issues);
  }

  const recommendations = Array.isArray(result?.recommendations)
    ? result?.recommendations
    : [];
  for (const [index, rec] of recommendations.entries()) {
    const title = typeof rec.title === "string" ? rec.title : "";
    const description = typeof rec.description === "string" ? rec.description : "";
    if (title) {
      scanText(title, `recommendations[${index}].title`, issues);
    }
    if (description) {
      scanText(description, `recommendations[${index}].description`, issues);
    }
  }

  if (issues.length > 0) {
    if (!context.flags) {
      context.flags = {};
    }
    context.flags.languageIssue = true;
  }

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    for (const issue of issues) {
      context.debug.push({
        step: "languageGuard",
        field: issue.field,
        issue: issue.issue,
      });
    }
  }
}
