// src/app/api/install/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const plan = searchParams.get("plan") || "basic";

    if (!shop) {
      return NextResponse.json({ error: "Parameter 'shop' fehlt" }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY!;
    const scopes = [
      "read_products",
      "write_products",
      "read_product_listings",
      "write_inventory",
      "read_inventory",
      "read_script_tags",
      "write_script_tags",
    ].join(",");

    // **MUSS** exakt mit der in Shopify hinterlegten Redirect URL übereinstimmen:
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL || "https://efro-dev.onrender.com"}/api/shopify/callback`;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(
      plan
    )}`;

    return NextResponse.json({ installUrl });
  } catch (e) {
    console.error("❌ Install-URL Fehler:", e);
    return NextResponse.json({ error: "Fehler beim Erzeugen der Install-URL" }, { status: 500 });
  }
}
