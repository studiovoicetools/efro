// src/app/api/checkout/url/route.ts
import { NextResponse } from "next/server";

/**
 * Diese Route gibt die zuletzt erstellte Checkout-URL zurück.
 * In einer echten App würde sie aus einer Session oder Datenbank kommen.
 * Hier nutzen wir einen Dummy-Mechanismus.
 */
let lastCheckoutUrl: string | null = null;

export async function GET() {
  if (lastCheckoutUrl) {
    return NextResponse.json({ success: true, checkoutUrl: lastCheckoutUrl });
  } else {
    return NextResponse.json({ success: false, error: "Kein Warenkorb gefunden" });
  }
}

export async function POST(request: Request) {
  const { checkoutUrl } = await request.json();
  lastCheckoutUrl = checkoutUrl;
  return NextResponse.json({ success: true });
}
