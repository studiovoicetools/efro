export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/test-shopify/route.ts
import { NextResponse } from "next/server";
import { shopifyFetch, PRODUCT_DEFAULT_VARIANT } from "@/lib/shopify";

export async function GET() {
  try {
    const data = await shopifyFetch(PRODUCT_DEFAULT_VARIANT, { handle: "t-shirt" });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}




