// src/lib/products/recommendationEngine.ts

import { mockCatalog, type EfroProduct, type ShoppingIntent } from "./mockCatalog";

/**
 * Score-Funktion: bewertet ein Produkt fuer einen bestimmten Intent.
 * Je hoeher der Score, desto eher passt es zur Suchabsicht.
 */
function scoreProductForIntent(intent: ShoppingIntent, p: EfroProduct): number {
  const text = `${p.title} ${p.description}`.toLowerCase();
  const tags = Array.isArray(p.tags) ? p.tags : [];
  const hasTag = (t: string) => tags.includes(t);

  let score = 0;

  // sichere Defaults fuer Rating und Popularitaet
  const rating = typeof p.rating === "number" ? p.rating : 0;
  const popularity = typeof p.popularityScore === "number" ? p.popularityScore : 0;

  // Basis: ein bisschen Punkte fuer Rating und Popularitaet
  score += rating * 2;          // max ca. 10 Punkte
  score += popularity / 10;     // 0..10

  switch (intent) {
    case "bargain": {
      // Guenstig / Budget
      if (hasTag("bargain") || hasTag("budget")) score += 20;
      if (p.price < 30) score += 15;
      if (p.price < 15) score += 10;
      if (text.includes("sale") || text.includes("discount")) score += 10;
      break;
    }

    case "premium": {
      // Premium, teuer, Luxus
      if (hasTag("premium") || hasTag("premium_price")) score += 20;
      if (p.price > 120) score += 15;
      if (
        text.includes("premium") ||
        text.includes("luxus") ||
        text.includes("luxury") ||
        text.includes("exclusive")
      ) {
        score += 15;
      }
      break;
    }

    case "gift": {
      // Geschenk-Charakter
      if (hasTag("gift") || p.category === "gift") score += 20;
      if (text.includes("gift") || text.includes("geschenk")) score += 15;
      // Mittleres Preisniveau bevorzugen
      if (p.price >= 20 && p.price <= 80) score += 10;
      break;
    }

    case "bundle": {
      // Sets / Bundles
      if (hasTag("bundle")) score += 20;
      if (text.includes("bundle") || text.includes("set") || text.includes("paket")) {
        score += 15;
      }
      break;
    }

    case "explore": {
      // Entdecken: wir pushen Produkte mit guten Ratings / Popularitaet
      // (Basis oben macht das schon, hier nur kleiner Bonus)
      if (rating >= 4.5) score += 5;
      if (popularity >= 80) score += 5;
      break;
    }

    case "quick_buy":
    default: {
      // Schneller Kauf: einfach die "besten" Produkte
      if (rating >= 4.5) score += 10;
      if (popularity >= 80) score += 10;
      break;
    }
  }

  return score;
}

/**
 * Neue Hauptfunktion:
 * - nimmt eine Produktliste (z. B. allProducts von getEfroProductsForShop)
 * - sortiert nach Score fuer den Intent
 * - gibt die Top-N Produkte zurueck
 */
export function getRecommendationsForIntentFromList(
  intent: ShoppingIntent,
  products: EfroProduct[],
  limit: number = 3
): EfroProduct[] {
  if (!Array.isArray(products) || products.length === 0) {
    return [];
  }

  const scored = products
    .map((p) => ({
      product: p,
      score: scoreProductForIntent(intent, p),
    }))
    .sort((a, b) => b.score - a.score);

  return scored
    .filter((entry) => entry.score > 0)
    .slice(0, limit)
    .map((entry) => entry.product);
}

/**
 * Rueckwaertskompatibel:
 * alte Signatur, falls irgendwo noch ohne allProducts aufgerufen wird.
 * Nutzt dann den mockCatalog.
 */
export function getRecommendationsForIntent(
  intent: ShoppingIntent,
  limit: number = 3
): EfroProduct[] {
  return getRecommendationsForIntentFromList(intent, mockCatalog, limit);
}
