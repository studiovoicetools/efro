// src/app/api/efro/debug-shop-meta/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";

export const dynamic = "force-dynamic";

/**
 * Debug-Endpoint, um zu sehen, welche Shop-Metadaten EFRO
 * für einen bestimmten Shop-Domain tatsächlich verwendet.
 *
 * Aufruf:
 *   /api/efro/debug-shop-meta?shop=test-shop.myshopify.com
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopParam = searchParams.get("shop") || "local-dev";

  const meta = await getShopMeta(shopParam);

  return NextResponse.json(
    {
      ok: true,
      shop: shopParam,
      meta,
    },
    { status: 200 }
  );
}
