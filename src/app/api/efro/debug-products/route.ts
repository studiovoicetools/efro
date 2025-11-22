import { NextRequest, NextResponse } from "next/server";
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

// WICHTIG: Diese Route ist bewusst dynamisch (weil wir request.url benutzen)
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  try {
    // Wir rufen unsere eigene Shopify-Route auf (die du eben getestet hast)
    const res = await fetch(`${baseUrl}/api/shopify-products`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from /api/shopify-products`);
    }

    const data = await res.json();
    const rawProducts: ShopifyProduct[] = Array.isArray(data.products)
      ? data.products
      : [];

    if (rawProducts.length === 0) {
      return NextResponse.json({
        products: mockCatalog,
        source:
          "mockCatalog (fallback: /api/shopify-products returned 0 products)",
      });
    }

    const products: EfroProduct[] = rawProducts.map(mapShopifyToEfro);

    return NextResponse.json({
      products,
      source: "shopify-products (mapped to EfroProduct)",
      rawCount: rawProducts.length,
    });
  } catch (err: any) {
    console.error("[api/efro/debug-products] error", err);
    return NextResponse.json({
      products: mockCatalog,
      source:
        "mockCatalog (fallback: error talking to /api/shopify-products)",
      error: err?.message ?? String(err),
    });
  }
}
