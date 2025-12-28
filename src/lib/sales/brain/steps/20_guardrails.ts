// src/lib/sales/brain/steps/20_guardrails.ts

import { SellerBrainContext } from "../../types";

const FREE_TERMS = ["free", "gratis", "kostenlos", "kostenfrei", "umsonst"];
const UNKNOWN_TERMS = ["unknown", "unbekannt", "undefined"];

function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
}

function hasFreeMention(text: string): boolean {
  const lower = text.toLowerCase();
  return FREE_TERMS.some((term) => lower.includes(term));
}

function hasUnknownMention(text: string): boolean {
  const lower = text.toLowerCase();
  return UNKNOWN_TERMS.some((term) => lower.includes(term));
}

function getCategoryKey(category: unknown): string | null {
  if (typeof category === "string") {
    const trimmed = category.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (category && typeof category === "object") {
    const key = (category as { category_key?: string }).category_key;
    if (typeof key === "string") {
      const trimmed = key.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
}

export async function runStep20_Guardrails(context: SellerBrainContext): Promise<void> {
  const finalReply = context.finalReply ?? "";
  const violations: string[] = [];
  const products = context.recommendedProducts ?? [];

  if (finalReply.trim().length === 0) {
    return;
  }

  const mentionsFree = hasFreeMention(finalReply);
  if (mentionsFree) {
    const hasZeroOrUnknownPrice = products.some((product: any) => {
      const price = (product as { price?: unknown }).price;
      return typeof price !== "number" || Number.isNaN(price) || price <= 0;
    });
    if (hasZeroOrUnknownPrice) {
      violations.push("freeWithoutPrice");
    }
  }

  const mentionsUnknownCategory = hasUnknownMention(finalReply);
  if (mentionsUnknownCategory) {
    const hasUnknownCategory = products.some((product: any) => {
      const categoryKey = getCategoryKey(product.category);
      return !categoryKey || categoryKey.toLowerCase() === "unknown";
    });
    if (hasUnknownCategory) {
      violations.push("unknownCategory");
    }
  }

  const hasMissingDescriptionProduct = products.some((product: any) => isBlank(product.description));
  if (hasMissingDescriptionProduct) {
    const lowerReply = finalReply.toLowerCase();
    const mentionsAnyProduct = products.some((product: any) => {
      const title = (product.title ?? "").toString().toLowerCase().trim();
      return title.length > 0 && lowerReply.includes(title);
    });
    if (mentionsAnyProduct) {
      violations.push("fictitiousDescription");
    }
  }

  if (violations.length > 0) {
    if (!context.flags) {
      context.flags = {};
    }
    context.flags.guardrailViolation = true;


    // Persistiere Violations, damit sie im finalen Result landen können
    const existing = (context as any).policyViolations;
    const list: string[] = Array.isArray(existing) ? existing : [];
    for (const v of violations) {
      if (!list.includes(v)) list.push(v);
    }
    (context as any).policyViolations = list;

    // Wenn FinalizeOutput bereits gelaufen ist: Result direkt aktualisieren
    if ((context as any).result) {
      try {
        (context as any).result.policyViolations = list;
        (context as any).result.flags = (context as any).result.flags ?? {};
        (context as any).result.flags.guardrailViolation = true;
        const finalReply = (context as any).finalReply ?? (context as any).replyText;
        if (typeof finalReply === "string" && finalReply.trim().length > 0) {
          (context as any).result.reply = finalReply;
        }
      } catch {
        // ignore
      }
    }

  }

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "guardrails",
      summary:
        violations.length === 0
          ? "0 violations"
          : `${violations.length} violations: ${violations.join(", ")}`,
    });
  }
}
