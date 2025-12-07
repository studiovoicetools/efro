// src/lib/sales/allProductsForShop.ts
// EFRO Testkatalog-Fix 2025-11-30: Gemeinsame Produkt-Lade-Logik für App und Test-Scripts

import { EfroProduct } from "@/lib/products/mockCatalog";
import { efroAttributeTestProducts } from "@/lib/catalog/efro-attribute-test-products";

type ShopifyProduct = {
  id: number | string;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string; // Komma-getrennt
  variants?: { price?: string }[];
  image?: { src?: string };
};

// HTML grob entfernen
function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapShopifyToEfro(list: ShopifyProduct[]): EfroProduct[] {
  return (list || []).map((p, index) => {
    const priceNumber = p.variants?.[0]?.price
      ? Number(p.variants[0].price)
      : NaN;

    const safePrice = Number.isFinite(priceNumber) ? priceNumber : 0;

    const tagsArray =
      p.tags
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean) ?? [];

    return {
      id: String(p.id ?? `shopify-${index}`),
      title: p.title || "Unbenanntes Produkt",
      description: stripHtml(p.body_html),
      price: safePrice, // Pflichtfeld
      imageUrl: p.image?.src || "/images/mock/gift-card-50.jpg", // Fallback-Bild
      tags: tagsArray,
      category: p.product_type || "misc",
    };
  });
}

/**
 * Lädt alle Produkte für einen Shop-Domain
 * 
 * EFRO Testkatalog-Fix 2025-11-30: Repliziert exakt die Logik aus page.tsx
 * für Test-Scripts, die ohne Next.js-Server laufen.
 * 
 * @param shopDomain - Shop-Domain (z. B. "local-dev")
 * @returns Promise<EfroProduct[]> - Aggregierte Produktliste (Shopify + optional Attribute-Demo)
 */
export async function getAllProductsForShopForTesting(
  shopDomain: string
): Promise<EfroProduct[]> {
  // Für local-dev: Versuche zuerst Shopify-API, dann Fallback auf mockCatalog
  try {
    // In Test-Umgebung: Versuche direkt Shopify-API (wenn env vars gesetzt)
    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (SHOP_DOMAIN && ADMIN_TOKEN) {
      // Direkter Shopify-API-Call (für Test-Scripts außerhalb von Next.js)
      const url = `https://${SHOP_DOMAIN}/admin/api/2024-01/products.json?limit=50`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-Shopify-Access-Token": ADMIN_TOKEN,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
          ? data.products
          : Array.isArray(data)
          ? data
          : [];

        if (shopifyProducts.length > 0) {
          let products = mapShopifyToEfro(shopifyProducts);

          // Optionale Test-Produkte für Attribut-Engine hinzufügen
          const enableAttributeDemo =
            process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
            shopDomain === "local-dev";

          if (enableAttributeDemo) {
            products = [...products, ...efroAttributeTestProducts];
          }

          console.log("[EFRO Test] Loaded products from Shopify API", {
            count: products.length,
            shopDomain,
            enableAttributeDemo,
          });

          return products;
        }
      }
    }

    // Fallback: Versuche Next.js API-Route (nur wenn in Next.js-Umgebung)
    // In Test-Scripts wird das wahrscheinlich nicht funktionieren, aber versuchen wir es
    if (typeof window === "undefined" && typeof global !== "undefined") {
      // Node.js-Umgebung: Versuche API-Route über localhost
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/shopify-products`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data = await res.json();
          const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data)
            ? data
            : [];

          if (shopifyProducts.length > 0) {
            let products = mapShopifyToEfro(shopifyProducts);

            // Optionale Test-Produkte für Attribut-Engine hinzufügen
            const enableAttributeDemo =
              process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
              shopDomain === "local-dev";

            if (enableAttributeDemo) {
              products = [...products, ...efroAttributeTestProducts];
            }

            console.log("[EFRO Test] Loaded products from Next.js API route", {
              count: products.length,
              shopDomain,
              enableAttributeDemo,
            });

            return products;
          }
        }
      } catch (apiErr) {
        // API-Route nicht verfügbar, weiter mit Fallback
        console.log("[EFRO Test] API route not available, using fallback", apiErr);
      }
    }

    // Finaler Fallback: mockCatalog
    throw new Error("Shopify API not available, using mockCatalog fallback");
  } catch (err) {
    console.log(
      "[EFRO Test] Shopify-Route fehlgeschlagen, Fallback auf mockCatalog",
      err
    );

    const { mockCatalog } = await import("@/lib/products/mockCatalog");
    let products = mockCatalog;

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
      shopDomain === "local-dev";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    console.log("[EFRO Test] Loaded products from mockCatalog", {
      count: products.length,
      shopDomain,
      enableAttributeDemo,
    });

    return products;
  }
}

