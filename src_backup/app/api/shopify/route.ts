export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * Diese Route wird vom Avatar oder der Installationslogik genutzt,
 * um Shopify-Shop-Informationen oder Auth-Daten abzufragen.
 * Sie läuft immer dynamisch, da `request.url` und `fetch` verwendet werden.
 */

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");

    if (!shop) {
      return NextResponse.json(
        { error: "Parameter 'shop' fehlt" },
        { status: 400 }
      );
    }

    console.log(`?? Shopify-GET für Shop: ${shop}`);

    // Beispiel-Shopify-Abfrage (kann später durch echten Call ersetzt werden)
    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    const redirectUri = `${process.env.APP_URL}/api/shopify/callback`;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=read_products,write_products&redirect_uri=${redirectUri}`;

    return NextResponse.json({
      success: true,
      shop,
      installUrl,
    });
  } catch (err: any) {
    console.error("? Shopify-Route-Fehler:", err);
    return NextResponse.json(
      { error: "Interner Serverfehler", detail: err.message },
      { status: 500 }
    );
  }
}

/**
 * Optionaler POST-Handler – falls du später z. B. Produktsynchronisation oder Webhooks
 * an diese Route schicken willst. Momentan leer, aber funktionsfähig.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("?? Shopify POST-Body:", body);

    return NextResponse.json({ received: true, data: body });
  } catch (err: any) {
    console.error("? Shopify-POST-Fehler:", err);
    return NextResponse.json(
      { error: "Fehler beim Verarbeiten der Anfrage", detail: err.message },
      { status: 500 }
    );
  }
}
