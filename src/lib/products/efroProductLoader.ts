// src/lib/products/efroProductLoader.ts
// EFRO Budget-Fix 2025-11-30: Produkt-Loader für Test-Scripts und App

import { EfroProduct } from "./mockCatalog";
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
 * Lädt Produkte für local-dev Shop-Domain
 * 
 * EFRO Budget-Fix 2025-11-30: Diese Funktion repliziert die Logik aus page.tsx
 * für Test-Scripts, die ohne Next.js-Server laufen.
 * 
 * @returns Promise<EfroProduct[]> - Aggregierte Produktliste (Shopify + optional Attribute-Demo)
 */
export async function loadEfroProductsForLocalDev(): Promise<EfroProduct[]> {
  // Für Test-Scripts: Versuche zuerst Shopify-API, dann Fallback auf mockCatalog
  try {
    // In Test-Umgebung: Wenn SHOPIFY_STORE_DOMAIN nicht gesetzt, verwende mockCatalog
    const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
      console.log("[EFRO ProductLoader] Shopify env vars missing, using mockCatalog");
      let products = await import("./mockCatalog").then((m) => m.mockCatalog);

      // Optionale Test-Produkte für Attribut-Engine hinzufügen
      const enableAttributeDemo =
        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";

      if (enableAttributeDemo) {
        products = [...products, ...efroAttributeTestProducts];
      }

      return products;
    }

    // Versuche Shopify-API (nur wenn in Next.js-Umgebung verfügbar)
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

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data)
      ? data
      : [];

    if (!shopifyProducts.length) {
      throw new Error("Keine Shopify-Produkte im Response");
    }

    let products = mapShopifyToEfro(shopifyProducts);

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    return products;
  } catch (err) {
    console.error(
      "[EFRO ProductLoader] Shopify-Route fehlgeschlagen, Fallback auf mockCatalog",
      err
    );

    let products = await import("./mockCatalog").then((m) => m.mockCatalog);

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    return products;
  }
}

