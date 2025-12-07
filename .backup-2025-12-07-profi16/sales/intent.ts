import type { ShoppingIntent } from "@/lib/products/mockCatalog";
import {
  PREMIUM_WORDS,
  BARGAIN_WORDS,
  GIFT_WORDS,
  BUNDLE_WORDS,
  EXPLORE_WORDS,
  MOST_EXPENSIVE_PATTERNS,
} from "./languageRules.de";

/**
 * Kleiner Normalizer – identisch zur sellerBrain-Variante
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return normalizeText(text);
}

/**
 * Intent-Erkennung basierend auf Keywords (premium/bargain/gift/bundle/explore)
 */
export function detectIntentFromText(
  text: string,
  currentIntent: ShoppingIntent
): ShoppingIntent {
  const t = normalize(text);

  // Intent-Wörter importiert aus languageRules.de.ts
  if (PREMIUM_WORDS.some((w) => t.includes(w))) {
    return "premium";
  }
  if (BARGAIN_WORDS.some((w) => t.includes(w))) {
    return "bargain";
  }
  if (GIFT_WORDS.some((w) => t.includes(w))) {
    return "gift";
  }
  if (BUNDLE_WORDS.some((w) => t.includes(w))) {
    return "bundle";
  }
  if (EXPLORE_WORDS.some((w) => t.includes(w))) {
    return "explore";
  }

  return currentIntent || "quick_buy";
}

/**
 * Prüft, ob der User „das teuerste“ o. Ä. möchte
 */
export function detectMostExpensiveRequest(text: string): boolean {
  const normalized = normalizeText(text);
  // Prüfe Patterns aus languageRules.de.ts
  for (const pattern of MOST_EXPENSIVE_PATTERNS) {
    if (typeof pattern === "string") {
      if (normalized.includes(pattern)) return true;
    } else if (pattern instanceof RegExp) {
      if (pattern.test(normalized)) return true;
    }
  }
  return false;
}
