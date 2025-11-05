// src/app/api/shopify/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const plan = searchParams.get("plan") || "basic";

    if (!shop) {
      return NextResponse.json({ error: "Shop parameter fehlt" }, { status: 400 });
    }

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/shopify/callback`;
    const clientId = process.env.SHOPIFY_CLIENT_ID;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=read_products,write_products,read_orders,write_orders&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&state=${plan}&grant_options[]=per-user`;

    console.log("ğŸ”— OAuth Start:", installUrl);

    return NextResponse.redirect(installUrl);
  } catch (err) {
    console.error("âŒ Fehler beim Start der Auth:", err);
    return NextResponse.json({ error: "Auth-Start fehlgeschlagen" }, { status: 500 });
  }
}

