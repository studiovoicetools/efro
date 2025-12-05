// src/app/api/efro/repository/products/route.ts
//
// API-Route für getProductsForShop (serverseitig)

import { NextRequest, NextResponse } from "next/server";
import { getProductsForShop, type EfroShop } from "@/lib/efro/efroSupabaseRepository";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shop = body.shop as EfroShop;

    if (!shop || !shop.id) {
      return NextResponse.json(
        { ok: false, error: "shop object with id required" },
        { status: 400 }
      );
    }

    const result = await getProductsForShop(shop);
    return NextResponse.json({
      ok: true,
      products: result.products,
      source: result.source,
    });
  } catch (error: any) {
    console.error("[efro/repository/products] error", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load products", products: [] },
      { status: 500 }
    );
  }
}

