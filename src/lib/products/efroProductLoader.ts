// src/lib/products/efroProductLoader.ts
// EFRO Budget-Fix 2025-11-30: Produkt-Loader für Test-Scripts und App

import type { EfroProduct } from "./mockCatalog.ts";
import { mockCatalog } from "./mockCatalog.ts";
import { efroAttributeTestProducts } from "../catalog/efro-attribute-test-products.ts";

export type { EfroProduct } from "./mockCatalog.ts";

export type LoadProductsResult = {
  success: boolean;
  source: "shopify" | "mock" | "none";
  products: EfroProduct[];
  error?: string;
  shopDomain?: string | null;
};

type ShopifyProduct = {
  id: number | string;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string; // Komma-getrennt
  variants?: { price?: string }[];
  image?: { src?: string };
};

// Helper: Prüft, ob Mock-Katalog verwendet werden soll
function shouldUseMock(shopDomain?: string | null): boolean {
  if (!shopDomain) return true;
  const normalized = shopDomain.trim().toLowerCase();
  return normalized === "demo" || normalized === "local-dev";
}

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
 * Lädt Produkte für einen Shop-Domain
 * 
 * Versucht echte Produkte aus Shopify zu laden (über /api/shopify-products).
 * Bei Fehler oder wenn keine Produkte gefunden werden, fällt auf mockCatalog zurück.
 * 
 * @param shopDomain - Shop-Domain (z. B. "demo", "local-dev", oder ein echter Shop-Domain)
 * @returns Promise<LoadProductsResult> - Ergebnis mit success, source, products, error
 */
export async function loadProductsForShop(
  shopDomain: string | null | undefined
): Promise<LoadProductsResult> {
  // Wenn Mock verwendet werden soll, direkt Mock-Katalog laden
  if (shouldUseMock(shopDomain)) {
    let products = [...mockCatalog];

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
      shopDomain?.trim().toLowerCase() === "local-dev";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    return {
      success: true,
      source: "mock",
      products,
      shopDomain: shopDomain ?? null,
    };
  }

  // Echte Shopify-Shop-Domain ermitteln
  const envDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim();
  const effectiveShopDomain = shopDomain?.trim() || envDomain;

  if (!effectiveShopDomain) {
    return {
      success: false,
      source: "none",
      products: [],
      error: "Missing shop domain (env + param)",
      shopDomain: null,
    };
  }

  // Versuche Shopify-Produkte zu laden
  try {
    const SHOP_DOMAIN = effectiveShopDomain;
    const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!ADMIN_TOKEN) {
      throw new Error("SHOPIFY_ADMIN_ACCESS_TOKEN not set");
    }

    // Direkter Shopify-API-Call (wie in loadEfroProductsForLocalDev)
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
      const bodyText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${bodyText}`);
    }

    const data = await res.json();
    const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data)
      ? data
      : [];

    if (shopifyProducts.length === 0) {
      throw new Error("Keine Shopify-Produkte im Response");
    }

    let products = mapShopifyToEfro(shopifyProducts);

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    return {
      success: true,
      source: "shopify",
      products,
      shopDomain: effectiveShopDomain,
    };
  } catch (err: any) {
    // Fehler beim Shopify-Fetch: Fallback auf Mock
    const errorMessage = err?.message || String(err);
    
    let products = [...mockCatalog];

    // Optionale Test-Produkte für Attribut-Engine hinzufügen
    const enableAttributeDemo =
      process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1";

    if (enableAttributeDemo) {
      products = [...products, ...efroAttributeTestProducts];
    }

    return {
      success: true,
      source: "mock",
      products,
      error: `Shopify fetch failed or empty for ${effectiveShopDomain}: ${errorMessage}`,
      shopDomain: effectiveShopDomain,
    };
  }
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

