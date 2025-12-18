import { NextRequest, NextResponse } from "next/server";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";
import { debugProductsScenarios } from "@/data/debugProducts.scenarios";

type ShopifyProduct = {
  id: string | number;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string;
  variants?: { price?: string | null }[]; // Shopify: price ist string
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

function safeParsePrice(priceRaw: unknown): number {
  // Shopify liefert "79.90" als string. In Fixtures kann auch 79,9 vorkommen.
  const s = String(priceRaw ?? "0").replace(",", ".");
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeTags(tagsRaw: unknown): string[] {
  if (Array.isArray(tagsRaw)) {
    return tagsRaw.map(String).map((t) => t.trim()).filter(Boolean);
  }
  if (typeof tagsRaw === "string") {
    return tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function mapShopifyToEfro(sp: ShopifyProduct): EfroProduct {
  const priceRaw = sp.variants?.[0]?.price ?? "0";
  const price = safeParsePrice(priceRaw);

  const tags = normalizeTags(sp.tags);

  const category =
    sp.product_type && sp.product_type.trim().length > 0
      ? sp.product_type.trim()
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

// bewusst dynamisch (kein Static Caching)
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };

  const debug: DebugResponse = {
    ok: false,
    source: "debug-products",
    step: "start",
  };

  try {
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const shop = url.searchParams.get("shop");
    const dataset = url.searchParams.get("dataset") ?? "";

    debug.step = "parsed-url";
    debug.baseUrl = baseUrl;
    debug.shop = shop;
    debug.dataset = dataset;

    // 1) dataset=scenarios -> Fixture zurückgeben (ohne Netzwerk / ohne Shopify)
    if (dataset === "scenarios") {
      debug.step = "fixture";
      debug.products = debugProductsScenarios as EfroProduct[];
      debug.productsSource = "fixture (debugProductsScenarios)";
      debug.rawCount = Array.isArray(debug.products) ? debug.products.length : 0;
      debug.ok = true;
      return NextResponse.json(debug, { status: 200, headers });
    }

    // 2) Normalmodus -> Shopify Produkte holen (shop param weiterreichen, falls vorhanden)
    const shopifyUrl = new URL("/api/shopify-products", baseUrl);
    if (shop) shopifyUrl.searchParams.set("shop", shop);

    debug.shopifyUrl = shopifyUrl.toString();
    debug.step = "fetching-shopify";

    const res = await fetch(debug.shopifyUrl, { cache: "no-store" });
    debug.shopifyStatus = res.status;

    if (!res.ok) {
      debug.step = "shopify-non-200";
      debug.error = `HTTP ${res.status} from /api/shopify-products`;
      debug.products = mockCatalog;
      debug.productsSource = "mockCatalog (fallback: bad HTTP status)";
      debug.rawCount = debug.products.length;
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
      debug.step = "shopify-empty";
      debug.products = mockCatalog;
      debug.productsSource =
        "mockCatalog (fallback: /api/shopify-products returned 0 products)";
      debug.ok = true;
      return NextResponse.json(debug, { status: 200, headers });
    }

    const products = rawProducts.map(mapShopifyToEfro);

    debug.step = "mapped";
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
    debug.rawCount = debug.products.length;
    debug.ok = false;
    return NextResponse.json(debug, { status: 200, headers });
  }
}
