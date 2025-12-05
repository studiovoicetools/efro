// src/app/api/efro/repository/shop/route.ts
//
// API-Route für getEfroShopByDomain (serverseitig)

import { NextRequest, NextResponse } from "next/server";
import { getEfroShopByDomain, getEfroDemoShop } from "@/lib/efro/efroSupabaseRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopDomain = searchParams.get("shopDomain");
    const isDemo = searchParams.get("isDemo") === "true";

    if (isDemo) {
      const shop = await getEfroDemoShop();
      return NextResponse.json({
        ok: true,
        shop,
      });
    }

    if (!shopDomain) {
      return NextResponse.json(
        { ok: false, error: "shopDomain parameter required" },
        { status: 400 }
      );
    }

    const shop = await getEfroShopByDomain(shopDomain);
    return NextResponse.json({
      ok: true,
      shop,
    });
  } catch (error: any) {
    console.error("[efro/repository/shop] error", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to load shop" },
      { status: 500 }
    );
  }
}




