// src/lib/products/enrichProducts.ts

import type { EfroProduct } from "./mockCatalog";

/**
 * Einfache Heuristik, um Produkte "smarter" zu machen:
 * - Tags aus Titel/Beschreibung ableiten (premium, bargain, gift, pet, beauty, etc.)
 * - Kategorie schaerfen (z. B. "pet", "beauty", "gift" statt immer "generic")
 * - Preis-Tier-Tags: "budget", "midrange", "premium_price"
 *
 * Nichts wird geloescht – vorhandene Tags bleiben erhalten, neue kommen dazu.
 */
export function enrichProducts(products: EfroProduct[]): EfroProduct[] {
  return products.map((p) => {
    const text = `${p.title} ${p.description}`.toLowerCase();

    let tags = Array.isArray(p.tags) ? [...p.tags] : [];
    let category = p.category || "generic";

    // 1) Basis-Kategorien nach Keywords
    if (
      text.includes("dog") ||
      text.includes("hund") ||
      text.includes("cat") ||
      text.includes("katze") ||
      text.includes("pet")
    ) {
      category = "pet";
      tags.push("pet");
    }

    if (
      text.includes("perfume") ||
      text.includes("parfum") ||
      text.includes("shampoo") ||
      text.includes("gel") ||
      text.includes("duschgel") ||
      text.includes("soap") ||
      text.includes("kosmetik")
    ) {
      category = "beauty";
      tags.push("beauty");
    }

    if (
      text.includes("gift") ||
      text.includes("geschenk") ||
      text.includes("present") ||
      text.includes("voucher") ||
      text.includes("gutschein")
    ) {
      category = "gift";
      tags.push("gift");
    }

    if (
      text.includes("tool") ||
      text.includes("schrauber") ||
      text.includes("akku") ||
      text.includes("drill") ||
      text.includes("werkzeug")
    ) {
      category = "tools";
      tags.push("tools");
    }

    if (
      text.includes("snowboard") ||
      text.includes("ski") ||
      text.includes("board")
    ) {
      if (category === "generic") {
        category = "sports";
      }
      tags.push("sports");
    }

    // 2) Premium / Budget nach Sprache & Preis
    if (
      text.includes("premium") ||
      text.includes("luxus") ||
      text.includes("luxury") ||
      text.includes("high end") ||
      text.includes("high-end")
    ) {
      tags.push("premium");
    }

    if (
      text.includes("cheap") ||
      text.includes("guenstig") ||
      text.includes("günstig") ||
      text.includes("discount") ||
      text.includes("sale")
    ) {
      tags.push("bargain");
    }

    // 3) Preis-basierte Tags (Budget/Midrange/Premium Price)
    if (typeof p.price === "number") {
      if (p.price < 30) {
        tags.push("budget");
      } else if (p.price >= 30 && p.price <= 120) {
        tags.push("midrange");
      } else if (p.price > 120) {
        tags.push("premium_price");
      }
    }

    // 4) Doppelte Tags entfernen
    const uniqueTags = Array.from(new Set(tags));

    return {
      ...p,
      category,
      tags: uniqueTags,
    };
  });
}
