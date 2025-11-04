// src/app/api/shopify/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get("shop");
    const code = searchParams.get("code");
    const hmac = searchParams.get("hmac");
    const state = searchParams.get("state") || "basic";

    if (!shop || !code || !hmac) {
      return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
    }

    // 🔐 HMAC prüfen (Authentizität)
    const params = Object.fromEntries(searchParams.entries());
    delete params["signature"];
    delete params["hmac"];

    const message = Object.keys(params)
      .sort()
      .map((key) => `${key}=${params[key]}`)
      .join("&");

    const generatedHmac = crypto
      .createHmac("sha256", process.env.SHOPIFY_CLIENT_SECRET || "")
      .update(message)
      .digest("hex");

    if (generatedHmac !== hmac) {
      console.warn("⚠️ Ungültige HMAC-Signatur:", { shop });
      return NextResponse.json({ error: "Ungültige HMAC-Signatur" }, { status: 400 });
    }

    // 🔑 Access Token abrufen
    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      console.error("❌ Kein Access Token erhalten:", tokenData);
      return NextResponse.json({ error: "Token-Anfrage fehlgeschlagen" }, { status: 500 });
    }

    console.log(`✅ Token für ${shop} erhalten`);
    // 🔜 Später: Speichern in Supabase (shop + token + plan)

    // Weiterleitung ins Admin-Dashboard
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/admin?shop=${shop}&plan=${state}`);
  } catch (err) {
    console.error("❌ Callback-Fehler:", err);
    return NextResponse.json({ error: "Auth-Callback fehlgeschlagen" }, { status: 500 });
  }
}
