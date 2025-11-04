// src/app/api/install/route.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Baut eine OAuth-Install-URL für Custom Distribution:
 * /api/install?shop=SHOP_DOMAIN&plan=basic|pro|enterprise
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
      "read_script_tags",
      "write_script_tags",
      // ggf. weitere benötigte Scopes ergänzen
    ].join(",");

    // Nach erfolgreichem OAuth kommst du hier zurück:
    const redirectUri =
      process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/shopify?plan=${plan}`
        : `http://localhost:3000/api/auth/callback/shopify?plan=${plan}`;

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.json({ installUrl });
  } catch (e) {
    console.error("Install-URL Fehler:", e);
    return NextResponse.json({ error: "Fehler beim Erzeugen der Install-URL" }, { status: 500 });
  }
}
