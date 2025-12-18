import { NextRequest, NextResponse } from "next/server";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";
import { debugProductsScenarios } from "../../../../data/debugProducts.scenarios";

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

type ShopifyProductsApiResponse = {
  products?: unknown;
};

type DebugResponse = {
  ok: boolean;
  source: "debug-products";
  step: string;
  baseUrl?: string;
  shop?: string | null;
  dataset?: string;
  shopifyUrl?: string;
  shopifyStatus?: number;
  rawCount?: number;
  products?: EfroProduct[];
  productsSource?: string;
  error?: string;
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

  const imageUrl = sp.image?.src ?? sp.images?.[0]?.src ?? "";

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

// Diese Route ist bewusst dynamisch (kein Static Caching)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const debug: DebugResponse = {
    ok: false,
    source: "debug-products",
    step: "start",
  };

  const headers = { "Cache-Control": "no-store" };

  try {
    const url = new URL(request.url);
    debug.step = "parsed-url";

    const baseUrl = `${url.protocol}//${url.host}`;
    const shop = url.searchParams.get("shop");
    const dataset = url.searchParams.get("dataset") ?? "";

    debug.baseUrl = baseUrl;
    debug.shop = shop;
    debug.dataset = dataset;

    // 1) dataset=scenarios -> Fixture zurückgeben (ohne Netzwerk / ohne Shopify)
    if (dataset === "scenarios") {
      debug.step = "dataset=scenarios";
      debug.products = debugProductsScenarios as EfroProduct[];
      debug.productsSource = "fixture (debugProductsScenarios)";
      debug.ok = true;
      return NextResponse.json(debug, { status: 200, headers });
    }

    // 2) Normalmodus -> Shopify Produkte holen (shop param weiterreichen, falls vorhanden)
    const shopifyUrl = new URL(`${baseUrl}/api/shopify-products`);
    if (shop) shopifyUrl.searchParams.set("shop", shop);

    debug.shopifyUrl = shopifyUrl.toString();
    debug.step = "fetching-shopify";

    const res = await fetch(debug.shopifyUrl, { cache: "no-store" });
    debug.shopifyStatus = res.status;
    debug.step = "fetched-shopify";

    if (!res.ok) {
      debug.error = `HTTP ${res.status} from /api/shopify-products`;
      debug.products = mockCatalog;
      debug.productsSource = "mockCatalog (fallback: bad HTTP status)";
      debug.ok = true;
      return NextResponse.json(debug, { status: 200, headers });
    }

    const data = (await res.json()) as ShopifyProductsApiResponse;
    debug.step = "parsed-json";

    const rawProducts = Array.isArray(data.products)
      ? (data.products as ShopifyProduct[])
      : [];
    debug.rawCount = rawProducts.length;

    if (rawProducts.length === 0) {
      debug.products = mockCatalog;
      debug.productsSource =
        "mockCatalog (fallback: /api/shopify-products returned 0 products)";
      debug.ok = true;
      return NextResponse.json(debug, { status: 200, headers });
    }

    const products: EfroProduct[] = rawProducts.map(mapShopifyToEfro);

    debug.products = products;
    debug.productsSource = "shopify-products (mapped to EfroProduct)";
    debug.ok = true;
    return NextResponse.json(debug, { status: 200, headers });
  } catch (err) {
    debug.step = "catch";
    debug.error = err instanceof Error ? err.message : String(err);
    debug.products = mockCatalog;
    debug.productsSource =
      "mockCatalog (fallback: error in debug-products handler)";
    debug.ok = false;
    return NextResponse.json(debug, { status: 200, headers });
  }
}
