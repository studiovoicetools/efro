// src/app/api/cart-test/route.ts
import { NextResponse } from "next/server";
import { getCartIdFromCookie, setCartIdCookie } from "@/lib/cookies";

export async function GET() {
  const existing = getCartIdFromCookie();
  if (existing) {
    return NextResponse.json({ found: true, cartId: existing });
  }
  const newId = "test_cart_" + Date.now();
  setCartIdCookie(newId);
  return NextResponse.json({ created: true, cartId: newId });
}
