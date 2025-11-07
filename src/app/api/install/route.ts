import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const plan = searchParams.get("plan") || "basic";

    if (!shop) {
      return NextResponse.json({ error: "Parameter 'shop' fehlt" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: "NEXT_PUBLIC_APP_URL fehlt" }, { status: 500 });
    }

    const clientId = process.env.SHOPIFY_API_KEY!;
    const scopes = [
      "read_products",
      "write_products",
      "read_script_tags",
      "write_script_tags",
      "read_inventory",
      "write_inventory",
      "read_product_listings"
    ].join(",");

    const redirectUri = `${appUrl}/api/shopify/callback?plan=${plan}`;
    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${encodeURIComponent(
      clientId
    )}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.json({ installUrl });
  } catch (e) {
    console.error("Install-URL Fehler:", e);
    return NextResponse.json(
      { error: "Fehler beim Erzeugen der Install-URL" },
      { status: 500 }
    );
  }
}
