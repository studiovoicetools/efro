// src/app/api/efro/suggest/route.ts

import { NextRequest, NextResponse } from "next/server";
import type {
  ShoppingIntent,
  EfroProduct,
} from "@/lib/products/mockCatalog";
import { runSellerBrain } from "@/lib/sales/sellerBrain";

type SuggestResponse = {
  shop: string;
  intent: ShoppingIntent;
  replyText: string;
  recommended: EfroProduct[];
  productCount: number;
  productsSource: string;
};

async function loadProductsViaDebugEndpoint(
  req: NextRequest,
  shop: string
): Promise<{ products: EfroProduct[]; source: string }> {
  // Basis-URL aus der aktuellen Request (z.B. http://localhost:3000)
  const baseUrl = req.nextUrl.origin;
  const url = new URL("/api/efro/debug-products", baseUrl);
  url.searchParams.set("shop", shop);

  const res = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `debug-products request failed with status ${res.status}`
    );
  }

  const data = await res.json().catch(() => ({} as any));
  const products = Array.isArray(data.products) ? data.products : [];
  const source =
    typeof data.source === "string"
      ? data.source
      : "debug-products (no explicit source)";

  return { products, source };
}

/**
 * GET /api/efro/suggest?shop=local-dev&text=zeige%20mir%20premium
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop") || "local-dev";
    const text = searchParams.get("text") || "";
    const prevIntent =
      (searchParams.get("prevIntent") as ShoppingIntent | null) ||
      "quick_buy";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Query parameter 'text' is required." },
        { status: 400 }
      );
    }

    // Produkte ueber deine bestehende Debug-Route holen
    const { products, source } = await loadProductsViaDebugEndpoint(
      req,
      shop
    );

    const brainResult = runSellerBrain(text, prevIntent, products);

    const payload: SuggestResponse = {
      shop,
      intent: brainResult.intent,
      replyText: brainResult.replyText,
      recommended: brainResult.recommended,
      productCount: products.length,
      productsSource: source,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/efro/suggest] GET error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/efro/suggest
 * Body (JSON):
 * {
 *   "shop": "avatarsalespro-dev.myshopify.com",
 *   "text": "zeige mir premium",
 *   "prevIntent": "quick_buy"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const shop =
      (typeof body.shop === "string" && body.shop.trim()) || "local-dev";
    const text =
      (typeof body.text === "string" && body.text.trim()) || "";
    const prevIntent: ShoppingIntent =
      typeof body.prevIntent === "string"
        ? (body.prevIntent as ShoppingIntent)
        : "quick_buy";

    if (!text) {
      return NextResponse.json(
        { error: "Field 'text' is required in JSON body." },
        { status: 400 }
      );
    }

    const { products, source } = await loadProductsViaDebugEndpoint(
      req,
      shop
    );

    const brainResult = runSellerBrain(text, prevIntent, products);

    const payload: SuggestResponse = {
      shop,
      intent: brainResult.intent,
      replyText: brainResult.replyText,
      recommended: brainResult.recommended,
      productCount: products.length,
      productsSource: source,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/efro/suggest] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
