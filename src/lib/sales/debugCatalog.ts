// src/lib/sales/debugCatalog.ts

import type { EfroProduct } from "@/lib/products/mockCatalog";

/**
 * Debug-Funktion für Katalog-Übersicht
 * 
 * Loggt:
 * - Gesamtanzahl Produkte
 * - Kategorien-Map (category -> count)
 * - 5 Beispielprodukte (Name, Kategorie, Preis)
 * 
 * Alle Logs mit Prefix "[EFRO Catalog Debug]" für einfache Suche in Logs.
 */
export function debugCatalogOverview(products: EfroProduct[]): void {
  // 1) Gesamtanzahl
  console.log("[EFRO Catalog Debug] total products:", products.length);

  // 2) Kategorien-Map (category -> count)
  const categoryMap = new Map<string, number>();
  
  for (const product of products) {
    const category = product.category || "(keine Kategorie)";
    const currentCount = categoryMap.get(category) || 0;
    categoryMap.set(category, currentCount + 1);
  }

  // Kategorien als Objekt für bessere Lesbarkeit
  const categoryCounts: Record<string, number> = {};
  for (const [category, count] of categoryMap.entries()) {
    categoryCounts[category] = count;
  }

  console.log("[EFRO Catalog Debug] categories:", categoryCounts);

  // 3) 5 Beispielprodukte
  const sampleProducts = products.slice(0, 5).map((p) => ({
    name: p.title,
    category: p.category || "(keine Kategorie)",
    price: p.price,
  }));

  console.log("[EFRO Catalog Debug] sample products:", sampleProducts);
}






