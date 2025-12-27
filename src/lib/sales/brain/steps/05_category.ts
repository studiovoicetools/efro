// src/lib/sales/brain/steps/05_category.ts

import type { SellerBrainContext } from "@/lib/sales/modules/types";
import { determineEffectiveCategory } from "@/lib/sales/modules/category";
import { normalize } from "@/lib/sales/modules/utils";

export async function runStep05_CategoryExtraction(
  context: SellerBrainContext
): Promise<void> {
  if (!context.category) {
    const text = context.inputText ?? "";
    const cleanedText = normalize(text);
    const categoryResult = determineEffectiveCategory({
      text,
      cleanedText,
      contextCategory: context.previousCategory ?? null,
      allProducts: context.catalog ?? [],
      category: context.category,
      catalog: context.catalog,
      intent: context.intent,
      tags: context.tags,
      previousIntent: context.previousIntent,
      previousCategory: context.previousCategory,
    } as any);

    context.category = categoryResult;
  }

  if (context.debug) {
    context.debug.push({
      step: "category",
      effectiveCategory: context.category,
    });
  } else {
    context.debug = [
      {
        step: "category",
        effectiveCategory: context.category,
      },
    ];
  }
}
