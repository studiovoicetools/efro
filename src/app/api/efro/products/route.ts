// src/app/api/efro/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadProductsForShop, type LoadProductsResult } from "@/lib/products/efroProductLoader";
import {
  getEfroShopByDomain,
  getEfroDemoShop,
  getProductsForShop,
} from "@/lib/efro/efroSupabaseRepository";

export async function GET(request: NextRequest) {
  try {
    // Shop-Domain aus Query-Parametern lesen
    const { searchParams } = new URL(request.url);
    const shopDomain = searchParams.get("shop");

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

