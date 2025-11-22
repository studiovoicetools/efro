
// src/app/api/efro/debug-products/route.ts
export const dynamic = "force-dynamic";


import { NextRequest, NextResponse } from "next/server";
import { getEfroProductsForShop } from "../../../../lib/products/shopifyMapper";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop") || "local-dev";

    const products = await getEfroProductsForShop(shop);

    return NextResponse.json(
      {
        shop,
        count: products.length,
        products,
        source: "getEfroProductsForShop (DEV, currently mockCatalog)",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/efro/debug-products] error:", err);
    return NextResponse.json(
      {
        error: "Failed to load products",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}
