// src/app/api/efro/shop-meta/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get("shop") || "local-dev";

    const meta = await getShopMeta(shop);

    return NextResponse.json({
      ok: true,
      shop,
      meta,
    });
  } catch (error) {
    console.error("[efro/shop-meta] error", error);
    return NextResponse.json(
      { ok: false, error: "Failed to load shop meta" },
      { status: 500 }
    );
  }
}
