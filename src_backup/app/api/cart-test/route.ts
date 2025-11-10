export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/cart-test/route.ts
import { NextResponse } from "next/server";

/**
 * ?? Health-Check für API.
 */
export async function GET() {
  const cartId = `TEST-${Math.floor(100000 + Math.random() * 900000)}`;
  return NextResponse.json({
    success: true,
    cartId,
    message: "?? Cart test endpoint is working ?",
  });
}


