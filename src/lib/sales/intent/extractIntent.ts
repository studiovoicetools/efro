import type { ShoppingIntent } from "@/lib/products/mockCatalog";
import { detectIntentFromText } from "../intent";

export function extractIntent(text: string, currentIntent: ShoppingIntent): ShoppingIntent {
  return detectIntentFromText(text, currentIntent);
}
