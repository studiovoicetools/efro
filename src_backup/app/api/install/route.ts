export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    if (!shop) {
      return NextResponse.json({ error: "Parameter 'shop' fehlt" }, { status: 400 });
    }

    // Beispielhafte Install-URL-Erzeugung
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=read_products,write_products&redirect_uri=${process.env.APP_URL}/api/shopify/callback`;

    return NextResponse.json({ installUrl });
  } catch (err: any) {
    console.error("Install-URL Fehler:", err);
    return NextResponse.json({ error: "Installationsfehler", detail: err.message }, { status: 500 });
  }
}
