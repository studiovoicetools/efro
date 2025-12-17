// src/app/api/efro/suggest/route.ts

import { NextRequest, NextResponse } from "next/server";
import type {
  ShoppingIntent,
  EfroProduct,
} from "@/lib/products/mockCatalog";
import {
  runSellerBrain,
  type SellerBrainContext,
} from "../../../../lib/sales/sellerBrain";
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
    // Plan-Parameter aus Query-String lesen (default: "starter" für lokale Tests)
    // TODO: Später echte Shop-Plan-Mapping implementieren
    const planParam = searchParams.get("plan") ?? "starter";

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

    // Context aus Query-Parameter (optional, für GET vorerst nicht genutzt)
    const context: SellerBrainContext | undefined = undefined;

    const brainResult = await runSellerBrain(
      text,
      prevIntent,
      products,
      planParam,
      undefined, // previousRecommended wird in GET vorerst nicht genutzt
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

    // Event-Logging nach erfolgreichem SellerBrain-Call
    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: brainResult.intent,
      productCount: brainResult.recommended.length,
      plan: null, // Plan kann später aus Shop-Meta geholt werden, falls nötig
      hadError: false,
      errorMessage: null,
    }).catch((err) => {
      // Logging-Fehler sollen die API-Antwort nicht beeinträchtigen
      console.error("[EFRO suggest] Logging failed (ignored)", err);
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/efro/suggest] GET error:", err);
    
    // Event-Logging für Fehlerfall
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
    }).catch(() => {
      // Ignoriere Logging-Fehler auch im Fehlerfall
    });
    
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
  let shop = "local-dev";
  let text = "";
  
  try {
    const body = await req.json().catch(() => ({} as any));

    shop =
      (typeof body.shop === "string" && body.shop.trim()) || "local-dev";
    text =
      (typeof body.text === "string" && body.text.trim()) || "";
    const prevIntent: ShoppingIntent =
      typeof body.prevIntent === "string"
        ? (body.prevIntent as ShoppingIntent)
        : "quick_buy";
    // Plan-Parameter aus Body lesen (default: "starter" für lokale Tests)
    const planParam = (typeof body.plan === "string" && body.plan.trim()) || "starter";

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

    // Optional: previousRecommended aus Body extrahieren (falls vorhanden)
    let previousRecommended: EfroProduct[] | undefined = undefined;
    if (Array.isArray(body.previousRecommendedIds) && body.previousRecommendedIds.length > 0) {
      const ids = body.previousRecommendedIds as string[];
      previousRecommended = products.filter((p) => ids.includes(p.id));
    }

    // Context aus Body extrahieren (optional)
    const context = body.context
      ? {
          activeCategorySlug:
            typeof body.context.activeCategorySlug === "string"
              ? body.context.activeCategorySlug
              : null,
        }
      : undefined;

    console.log("[EFRO SB API] Incoming context", context);

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

    // Event-Logging nach erfolgreichem SellerBrain-Call
    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: brainResult.intent,
      productCount: brainResult.recommended.length,
      plan: null, // Plan kann später aus Shop-Meta geholt werden, falls nötig
      hadError: false,
      errorMessage: null,
    }).catch((err) => {
      // Logging-Fehler sollen die API-Antwort nicht beeinträchtigen
      console.error("[EFRO suggest] Logging failed (ignored)", err);
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/efro/suggest] POST error:", err);
    
    // Event-Logging für Fehlerfall
    await logEfroEventServer({
      shopDomain: shop || "local-dev",
      userText: text,
      intent: null,
      productCount: 0,
      plan: null,
      hadError: true,
      errorMessage: err instanceof Error ? err.message : "Unknown error",
    }).catch(() => {
      // Ignoriere Logging-Fehler auch im Fehlerfall
    });
    
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
