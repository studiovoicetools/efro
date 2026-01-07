// src/app/api/efro/suggest/route.ts

import { NextRequest, NextResponse } from "next/server";
import type { ShoppingIntent, EfroProduct } from "@/lib/products/mockCatalog";
import { runSellerBrain, type SellerBrainContext } from "../../../../lib/sales/sellerBrain";
import type { SellerBrainAiTrigger } from "../../../../lib/sales/modules/aiTrigger";
import { logEfroEventServer } from "@/lib/efro/logEventServer";

type SuggestResponse = {
  shop: string;
  intent: ShoppingIntent;
  replyText: string;
  recommended: EfroProduct[];
  productCount: number;
  productsSource: string;
  sellerBrain?: {
    nextContext?: SellerBrainContext | null;
    aiTrigger?: SellerBrainAiTrigger;
  };
};

async function loadProductsViaEfroProductsEndpoint(
  req: NextRequest,
  shop: string
): Promise<{ products: EfroProduct[]; source: string }> {
  const baseUrl = req.nextUrl.origin;
  const url = new URL("/api/efro/products", baseUrl);
  url.searchParams.set("shop", shop);
  url.searchParams.set("debug", "1");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`efro/products request failed with status ${res.status}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const products = Array.isArray((data as any).products) ? (data as any).products : [];
  const source = typeof (data as any).source === "string" ? (data as any).source : "efro/products";

  return { products, source };
}

async function loadProductsViaDebugEndpoint(
  req: NextRequest,
  shop: string
): Promise<{ products: EfroProduct[]; source: string }> {
  const baseUrl = req.nextUrl.origin;
  const url = new URL("/api/efro/debug-products", baseUrl);
  url.searchParams.set("shop", shop);

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`debug-products request failed with status ${res.status}`);
  }

  const data = await res.json().catch(() => ({} as any));
  const products = Array.isArray((data as any).products) ? (data as any).products : [];
  const source =
    typeof (data as any).productsSource === "string"
      ? (data as any).productsSource
      : (typeof (data as any).source === "string" ? (data as any).source : "debug-products");

  return { products, source };
}

async function loadProductsForSuggest(
  req: NextRequest,
  shop: string
): Promise<{ products: EfroProduct[]; source: string }> {
  // Gate-1: Shop-Truth first
  try {
    const r = await loadProductsViaEfroProductsEndpoint(req, shop);
    if (Array.isArray(r.products) && r.products.length > 0) return r;
  } catch {
    // ignore -> fallback
  }

  // Fallback: debug-products (legacy)
  return await loadProductsViaDebugEndpoint(req, shop);
}

/**
 * GET /api/efro/suggest?shop=...&text=...
 */
export async function GET(req: NextRequest) {
  const debugHeader = req.headers.get("x-efro-debug") === "1";

  try {
    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop") || "local-dev";
    const text = searchParams.get("text") || "";
    const prevIntent = (searchParams.get("prevIntent") as ShoppingIntent | null) || "quick_buy";
    const planParam = searchParams.get("plan") ?? "starter";

    if (!text.trim()) {
      return NextResponse.json({ error: "Query parameter 'text' is required." }, { status: 400 });
    }

    const { products, source } = await loadProductsForSuggest(req, shop);

    const context: SellerBrainContext | undefined = undefined;

    const brainResult = await runSellerBrain(
      text,
      prevIntent,
      products,
      planParam,
      undefined,
      context
    );

    const payload: SuggestResponse = {
      shop,
      intent: brainResult.intent,
      replyText: brainResult.replyText,
      recommended: brainResult.recommended,
      productCount: products.length,
      productsSource: source,
      sellerBrain: {
        nextContext: brainResult.nextContext ?? null,
        aiTrigger: brainResult.aiTrigger,
      },
    };

    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: brainResult.intent,
      productCount: brainResult.recommended.length,
      plan: null,
      hadError: false,
      errorMessage: null,
    }).catch((err) => {
      console.error("[EFRO suggest] Logging failed (ignored)", err);
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("[/api/efro/suggest] GET error:", err);

    const { searchParams } = req.nextUrl;
    const shop = searchParams.get("shop") || "local-dev";
    const text = searchParams.get("text") || "";

    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: null,
      productCount: 0,
      plan: null,
      hadError: true,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    }).catch(() => {});

    return NextResponse.json(
      debugHeader
        ? { error: "Internal server error.", debug: { message: err?.message || String(err) } }
        : { error: "Internal server error." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/efro/suggest
 */
export async function POST(req: NextRequest) {
  const debugHeader = req.headers.get("x-efro-debug") === "1";

  let shop = "local-dev";
  let text = "";

  try {
    const body = await req.json().catch(() => ({} as any));

    shop = (typeof body.shop === "string" && body.shop.trim()) || "local-dev";
    text = (typeof body.text === "string" && body.text.trim()) || "";
    const prevIntent: ShoppingIntent =
      typeof body.prevIntent === "string" ? (body.prevIntent as ShoppingIntent) : "quick_buy";
    const planParam = (typeof body.plan === "string" && body.plan.trim()) || "starter";

    if (!text) {
      return NextResponse.json({ error: "Field 'text' is required in JSON body." }, { status: 400 });
    }

    const { products, source } = await loadProductsForSuggest(req, shop);

    let previousRecommended: EfroProduct[] | undefined = undefined;
    if (Array.isArray(body.previousRecommendedIds) && body.previousRecommendedIds.length > 0) {
      const ids = body.previousRecommendedIds as string[];
      previousRecommended = products.filter((p) => ids.includes((p as any).id));
    }

    const context = body.context
      ? {
          activeCategorySlug:
            typeof body.context.activeCategorySlug === "string" ? body.context.activeCategorySlug : null,
        }
      : undefined;

    const brainResult = await runSellerBrain(
      text,
      prevIntent,
      products,
      planParam,
      previousRecommended,
      context
    );

    const payload: SuggestResponse = {
      shop,
      intent: brainResult.intent,
      replyText: brainResult.replyText,
      recommended: brainResult.recommended,
      productCount: products.length,
      productsSource: source,
      sellerBrain: {
        nextContext: brainResult.nextContext ?? null,
        aiTrigger: brainResult.aiTrigger,
      },
    };

    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: brainResult.intent,
      productCount: brainResult.recommended.length,
      plan: null,
      hadError: false,
      errorMessage: null,
    }).catch((err) => {
      console.error("[EFRO suggest] Logging failed (ignored)", err);
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    console.error("[/api/efro/suggest] POST error:", err);

    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: null,
      productCount: 0,
      plan: null,
      hadError: true,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    }).catch(() => {});

    return NextResponse.json(
      debugHeader
        ? { error: "Internal server error.", debug: { message: err?.message || String(err) } }
        : { error: "Internal server error." },
      { status: 500 }
    );
  }
}
