// src/lib/products/relatedProducts.ts

import { EfroProduct } from "./mockCatalog";

/**
 * Berechnet einen einfachen Aehnlichkeits-Score zwischen zwei Produkten.
 * Basis:
 *  - gemeinsame Tags
 *  - gleiche Kategorie
 *  - aehnlicher Preisbereich
 */
function similarityScore(a: EfroProduct, b: EfroProduct): number {
  if (a.id === b.id) return 0;

  let score = 0;

  // Gemeinsame Tags
  const tagsA = new Set(a.tags);
  const commonTags = b.tags.filter((t) => tagsA.has(t));
  score += commonTags.length * 2; // jeder gemeinsame Tag gibt 2 Punkte

  // Gleiche Kategorie
  if (a.category && b.category && a.category === b.category) {
    score += 3;
  }

  // Aehnlicher Preisbereich (z. B. innerhalb von 20 %)
  const minPrice = Math.min(a.price, b.price);
  const maxPrice = Math.max(a.price, b.price);
  if (minPrice > 0 && maxPrice / minPrice <= 1.2) {
    score += 1;
  }

  return score;
}

/**
 * Gibt passende Cross-Sell-Produkte fuer ein gegebenes Produkt zurueck.
 * - `allProducts`: kompletter Katalog (z. B. aus Shopify oder Mock)
 * - `limit`: max. Anzahl an Vorschlaegen
 */
export function getRelatedProducts(
  base: EfroProduct,
  allProducts: EfroProduct[],
  limit: number = 3
): EfroProduct[] {
  const scored = allProducts
    .filter((p) => p.id !== base.id)
    .map((p) => ({
      product: p,
      score: similarityScore(base, p),
    }))
    .filter((entry) => entry.score > 0);

  // Fallback: wenn keine Aehnlichkeit gefunden, einfach andere Produkte
  if (scored.length === 0) {
    return allProducts
      .filter((p) => p.id !== base.id)
      .slice(0, limit);
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.product);
}
