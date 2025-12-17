// src/app/api/efro/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadProductsForShop, type LoadProductsResult } from "@/lib/products/efroProductLoader";
import {
  getEfroShopByDomain,
  getEfroDemoShop,
  getProductsForShop,
} from "@/lib/efro/efroSupabaseRepository";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";

type ShopifyProduct = {
  id: string | number;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string;
  variants?: { price?: string | null }[];
  image?: { src?: string | null } | null;
  images?: { src?: string | null }[];
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function mapShopifyToEfro(sp: ShopifyProduct): EfroProduct {
  const priceRaw =
    sp.variants && sp.variants.length > 0 && sp.variants[0]?.price
      ? sp.variants[0].price!
      : "0";
  const price = Number.parseFloat(priceRaw) || 0;

  const tags: string[] =
    sp.tags
      ?.split(",")
      .map((t) => t.trim())
      .filter(Boolean) ?? [];

  const category =
    sp.product_type && sp.product_type.trim().length > 0
      ? sp.product_type
      : "shopify";

  const description =
    sp.body_html && sp.body_html.trim().length > 0
      ? stripHtml(sp.body_html)
      : sp.title;

  const imageUrl =
    (sp.image && sp.image.src) ||
    (sp.images && sp.images[0]?.src) ||
    "";

  return {
    id: String(sp.id),
    title: sp.title,
    description,
    price,
    imageUrl,
    tags,
    category,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Shop-Domain aus Query-Parametern lesen
    const { searchParams } = new URL(request.url);
    const shopDomain = searchParams.get("shop");

    // Für shop=demo: Verwende dieselbe Logik wie debug-products (Szenario-Tests)
    if (shopDomain?.trim().toLowerCase() === "demo") {
      const url = new URL(request.url);
      const baseUrl = `${url.protocol}//${url.host}`;

      try {
        const res = await fetch(`${baseUrl}/api/shopify-products`, {
          cache: "no-store",
        });

        if (!res.ok) {
          return NextResponse.json({
            success: true,
            source: "mock",
            products: mockCatalog,
            shopDomain: "demo",
          });
        }

        const data = await res.json();
        const rawProducts: ShopifyProduct[] = Array.isArray(data.products)
          ? data.products
          : [];

        if (rawProducts.length === 0) {
          return NextResponse.json({
            success: true,
            source: "mock",
            products: mockCatalog,
            shopDomain: "demo",
          });
        }

        const products: EfroProduct[] = rawProducts.map(mapShopifyToEfro);

        return NextResponse.json({
          success: true,
          source: "shopify",
          products,
          shopDomain: "demo",
        });
      } catch (err: any) {
        return NextResponse.json({
          success: true,
          source: "mock",
          products: mockCatalog,
          shopDomain: "demo",
        });
      }
    }

    // Versuche zuerst Repository (Supabase) zu verwenden
    let shop = await getEfroShopByDomain(shopDomain || "");
    if (!shop) {
      shop = await getEfroDemoShop();
    }

    if (shop) {
      // Repository-Produkte laden
      const repoResult = await getProductsForShop(shop);
      
      if (repoResult.products.length > 0) {
        // Verwende die echte Quelle aus getProductsForShop (nicht shop.isDemo!)
        return NextResponse.json({
          success: true,
          source: repoResult.source,
          products: repoResult.products,
          shopDomain: shopDomain || null,
        });
      }
    }

    // Fallback: loadProductsForShop (Shopify/Mock)
    const result: LoadProductsResult = await loadProductsForShop(shopDomain || null);

    // Ergebnis als JSON zurückgeben
    return NextResponse.json(result);
  } catch (err: any) {
    // Unerwarteter Fehler: 500 mit Fehler-Objekt
    console.error("[EFRO Products API] Unexpected error", err);
    return NextResponse.json(
      {
        success: false,
        source: "none" as const,
        products: [],
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}

