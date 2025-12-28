// src/lib/sales/brain/steps/06_tags.ts

import { SellerBrainContext } from "@/lib/sales/modules/types";

export async function runStep06_TagDetection(context: SellerBrainContext): Promise<void> {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const tagsRaw = context.product?.tags;
  let tagsText = "";

  if (Array.isArray(tagsRaw)) {
    tagsText = tagsRaw.map((t) => normalize(String(t))).join(" ");
  } else if (typeof tagsRaw === "string") {
    tagsText = normalize(tagsRaw);
  }

  context.tags = tagsText
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.trim());

  if (context.debugMode) {
    if (context.debug) {
      context.debug.push({
        step: "tags",
        raw: tagsRaw,
        tags: context.tags,
      });
    } else {
      context.debug = [
        {
          step: "tags",
          raw: tagsRaw,
          tags: context.tags,
        },
      ];
    }
  }
}
