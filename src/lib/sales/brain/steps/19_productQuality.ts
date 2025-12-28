// src/lib/sales/brain/steps/19_productQuality.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

type ProductQuality = "eligible" | "soft-bad" | "strict-bad";

type ProductQualityReport = {
  counts: { eligible: number; softBad: number; strictBad: number };
  reasons: Record<string, string[]>;
  examples: Record<string, string>;
};

function isBlank(value?: string | null): boolean {
  return !value || value.trim().length === 0;
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

function addReason(
  report: ProductQualityReport,
  reason: string,
  productId: string
): void {
  if (!report.reasons[reason]) {
    report.reasons[reason] = [];
  }
  report.reasons[reason].push(productId);

  if (!report.examples[reason]) {
    report.examples[reason] = productId;
  }
}

export async function runStep19_ProductQuality(context: SellerBrainContext): Promise<void> {
  const report: ProductQualityReport = {
    counts: { eligible: 0, softBad: 0, strictBad: 0 },
    reasons: {},
    examples: {},
  };

  const products = context.recommendedProducts ?? [];

  for (const product of products) {
    const productIdRaw =
      typeof product.id === "string" ? product.id.trim() : "";
    const productId = productIdRaw || "unknown-id";

    const strictReasons: string[] = [];
    const softReasons: string[] = [];

    if (isBlank(product.title)) strictReasons.push("missing_title");
    if (isBlank(product.id)) strictReasons.push("missing_id");

    const price = (product as { price?: unknown }).price;
    if (typeof price !== "number" || Number.isNaN(price)) {
      strictReasons.push("invalid_price");
    } else if (price <= 0) {
      softReasons.push("price_non_positive");
    }

    const categoryKey = getCategoryKey(product.category);
    if (!categoryKey) {
      strictReasons.push("missing_category");
    } else if (categoryKey.toLowerCase() === "unknown") {
      softReasons.push("category_unknown");
    }

    if (isBlank(product.description)) softReasons.push("missing_description");

    let quality: ProductQuality = "eligible";
    if (strictReasons.length > 0) {
      quality = "strict-bad";
      report.counts.strictBad += 1;
      for (const reason of strictReasons) {
        addReason(report, reason, productId);
      }
    } else if (softReasons.length > 0) {
      quality = "soft-bad";
      report.counts.softBad += 1;
      for (const reason of softReasons) {
        addReason(report, reason, productId);
      }
    } else {
      report.counts.eligible += 1;
    }

    product.quality = quality;
  }

  if (!context.result) {
    context.result = {};
  }
  (context.result as { productQuality?: ProductQualityReport }).productQuality = report;

  if (context.debugMode) {
    if (!context.debug) {
      context.debug = [];
    }
    context.debug.push({
      step: "productQuality",
      summary: `${report.counts.eligible} eligible, ${report.counts.softBad} soft-bad, ${report.counts.strictBad} strict-bad`,
    });
  }
}
