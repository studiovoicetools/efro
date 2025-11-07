// src/app/api/shopify/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs"; // ⬅️ NEU

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function verifyHmac(searchParams: URLSearchParams, secret: string) {
  const params: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) {
    if (k !== "hmac" && k !== "signature") params[k] = v;
  }
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const given = searchParams.get("hmac") || "";
  return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(given, "utf8"));
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const shop = sp.get("shop");
    const code = sp.get("code");
    const plan = sp.get("state") || sp.get("plan") || "basic";
    const hmac = sp.get("hmac");

    if (!shop || !code || !hmac) {
      return NextResponse.json({ error: "Fehlende Parameter (shop|code|hmac)" }, { status: 400 });
    }

    const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || "";
    if (!secret) {
      return NextResponse.json({ error: "SHOPIFY_CLIENT_SECRET fehlt" }, { status: 500 });
    }

    if (!verifyHmac(sp, secret)) {
      return NextResponse.json({ error: "Ungültige HMAC-Signatur" }, { status: 400 });
    }

    // Access Token holen
    const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY,
        client_secret: secret,
        code,
      }),
    });

    const tokenData = await tokenResp.json();
    if (!tokenResp.ok || !tokenData.access_token) {
      console.error("❌ Kein Access Token:", tokenData);
      return NextResponse.json({ error: "Token-Anfrage fehlgeschlagen", details: tokenData }, { status: 500 });
    }

    // In Supabase speichern/upserten
    const { error } = await supabase
      .from("shops")
      .upsert(
        {
          shop,
          access_token: tokenData.access_token,
          plan,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop" }
      );

    if (error) {
      console.error("❌ Supabase upsert error:", error);
      return NextResponse.json({ error: "DB Fehler", details: error.message }, { status: 500 });
    }

    // Weiter ins Admin UI
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || url.origin;
    return NextResponse.redirect(`${appUrl}/admin?shop=${encodeURIComponent(shop)}&installed=1`);
  } catch (err: any) {
    console.error("❌ Callback-Fehler:", err);
    return NextResponse.json({ error: "Auth-Callback fehlgeschlagen", details: err?.message }, { status: 500 });
  }
}
