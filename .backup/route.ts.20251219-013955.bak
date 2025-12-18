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

// diese Route ist bewusst dynamisch
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const debug: any = {
    ok: false,
    source: "debug-products",
    step: "start",
  };

  try {
    // Basis-URL bestimmen
    const url = new URL(request.url);
    debug.step = "parsed-url";
    const baseUrl = `${url.protocol}//${url.host}`;
    debug.baseUrl = baseUrl;

    // Shopify Produkte holen
    const res = await fetch(`${baseUrl}/api/shopify-products`, {
      cache: "no-store",
    });
    debug.step = "fetched-shopify";
    debug.shopifyStatus = res.status;

    if (!res.ok) {
      debug.error = `HTTP ${res.status} from /api/shopify-products`;
      debug.products = mockCatalog;
      debug.productsSource = "mockCatalog (fallback: bad HTTP status)";
      debug.ok = true;
      return NextResponse.json(debug);
    }

    const data = await res.json();
    debug.step = "parsed-json";

    const rawProducts: ShopifyProduct[] = Array.isArray(data.products)
      ? data.products
      : [];
    debug.rawCount = rawProducts.length;

    if (rawProducts.length === 0) {
      debug.products = mockCatalog;
      debug.productsSource =
        "mockCatalog (fallback: /api/shopify-products returned 0 products)";
      debug.ok = true;
      return NextResponse.json(debug);
    }

    const products: EfroProduct[] = rawProducts.map(mapShopifyToEfro);

    debug.products = products;
    debug.productsSource = "shopify-products (mapped to EfroProduct)";
    debug.ok = true;
    return NextResponse.json(debug);
  } catch (err: any) {
    debug.step = "catch";
    debug.error = err?.message ?? String(err);
    debug.products = mockCatalog;
    debug.productsSource =
      "mockCatalog (fallback: error in debug-products handler)";
    debug.ok = false;
    return NextResponse.json(debug);
  }
}
