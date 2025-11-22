// src/lib/products/shopifyMapper.ts

import { getSupabaseClient } from "@/lib/getSupabaseClient";
import type { EfroProduct } from "./mockCatalog";
import { mockCatalog } from "./mockCatalog";
import { enrichProducts } from "./enrichProducts";

/**
 * Mappt einen Supabase-Produkt-Row in das EfroProduct-Format.
 * Sehr defensiv: viele Fallbacks, damit es auch bei ungewohnten Tabellen nicht crasht.
 */
function mapSupabaseRowToEfroProduct(row: any): EfroProduct {
  // ID als string
  const id =
    (row.id && String(row.id)) ||
    row.handle ||
    row.sku ||
    `product-${Math.random().toString(36).slice(2)}`;

  const title =
    row.title ||
    row.name ||
    row.product_title ||
    row.product_name ||
    "Unnamed product";

  const description =
    row.description ||
    row.body_html ||
    row.product_description ||
    "";

  // Preis als number
  let price = 0;
  if (typeof row.price === "number") {
    price = row.price;
  } else if (typeof row.price === "string") {
    const parsed = parseFloat(row.price.replace(",", "."));
    if (!Number.isNaN(parsed)) price = parsed;
  } else if (typeof row.amount === "number") {
    price = row.amount;
  }

  const imageUrl =
    row.image_url ||
    row.imageUrl ||
    row.main_image ||
    row.featured_image ||
    null;

  let tags: string[] = [];
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === "string") {
    tags = row.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
  }

  const category =
    row.category ||
    row.product_type ||
    (tags.includes("dog") || tags.includes("cat") ? "pet" : "generic");

  const rating =
    typeof row.rating === "number"
      ? row.rating
      : typeof row.rating === "string"
      ? parseFloat(row.rating.replace(",", ".")) || 0
      : 0;

  const popularityScore =
    typeof row.popularity_score === "number"
      ? row.popularity_score
      : typeof row.popularityScore === "number"
      ? row.popularityScore
      : typeof row.popularity === "number"
      ? row.popularity
      : 0;

  return {
    id,
    title,
    description,
    price,
    imageUrl,
    tags,
    category,
    rating,
    popularityScore,
  };
}

/**
 * Zentrale Funktion:
 * - versucht, Produkte aus Supabase Tabelle "products" zu holen
 * - mapped sie in EfroProduct
 * - laesst alles durch enrichProducts laufen (Tags/Kategorie smarter machen)
 * - faellt bei jedem Problem sauber auf mockCatalog zurueck
 */
export async function getEfroProductsForShop(
  shopDomain: string
): Promise<EfroProduct[]> {
  try {
    const supabase = getSupabaseClient();

    // Sehr generische Query – spaeter kannst du nach shopDomain filtern
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .limit(200);

    if (error) {
      console.error(
        "[getEfroProductsForShop] Supabase error, fallback to mockCatalog:",
        error.message || error
      );
      return enrichProducts(mockCatalog);
    }

    if (!data || data.length === 0) {
      console.warn(
        "[getEfroProductsForShop] Supabase products empty, fallback to mockCatalog"
      );
      return enrichProducts(mockCatalog);
    }

    const mapped: EfroProduct[] = data.map(mapSupabaseRowToEfroProduct);

    // WICHTIG: Alle "live" Produkte laufen durch die gleiche Enrichment-Logik
    return enrichProducts(mapped);
  } catch (err: any) {
    console.error(
      "[getEfroProductsForShop] Fatal error, fallback to mockCatalog:",
      err?.message || err
    );
    return enrichProducts(mockCatalog);
  }
}
