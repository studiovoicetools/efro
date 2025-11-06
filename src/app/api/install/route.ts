// src/app/api/install/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * 🚀 Shopify Installations-Handler
 * Startet den OAuth-Flow für die App-Installation.
 * Beispiel: /api/install?shop=mystore.myshopify.com&plan=basic|pro|enterprise
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const plan = searchParams.get("plan") || "basic";

    if (!shop) {
      return NextResponse.json({ error: "Parameter 'shop' fehlt" }, { status: 400 });
    }

    const clientId = process.env.SHOPIFY_API_KEY!;
    const scopes = [
      "read_products",
      "write_products",
      "read_customers",
      "read_orders",
      "write_script_tags",
      "read_script_tags"
    ].join(",");

    const redirectUri =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback?plan=${plan}`
        : `http://localhost:3000/api/shopify/callback?plan=${plan}`;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    console.log("🔗 Install URL erstellt:", installUrl);

    // Direkt weiterleiten
    return NextResponse.redirect(installUrl);
  } catch (e) {
    console.error("❌ Install-URL Fehler:", e);
    return NextResponse.json({ error: "Fehler beim Erzeugen der Install-URL" }, { status: 500 });
  }
}

export const runtime = "nodejs";
