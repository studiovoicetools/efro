// src/app/api/efro/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadProductsForShop, type LoadProductsResult } from "@/lib/products/efroProductLoader";

export async function GET(request: NextRequest) {
  try {
    // Shop-Domain aus Query-Parametern lesen
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop");

    // loadProductsForShop aufrufen
    const result: LoadProductsResult = await loadProductsForShop(shop || null);

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

