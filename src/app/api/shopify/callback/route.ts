// src/app/api/shopify/callback/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyOauthHmac } from "@/lib/shopify/verifyOauthHmac";
import { exchangeShopifyAccessToken } from "@/lib/shopify/oauth";
import { getEfroSupabaseServerClient } from "@/lib/efro/supabaseServer";

function normalizeShop(shop: string): string {
  return (shop || "").trim().toLowerCase();
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

function getClientId(): string {
  return (process.env.SHOPIFY_API_KEY || "").trim();
}

function getClientSecret(): string {
  // Du hast mehrere Namen im .env.local – wir nehmen den robusten Fallback.
  return (
    (process.env.SHOPIFY_API_SECRET || "").trim() ||
    (process.env.SHOPIFY_CLIENT_SECRET || "").trim()
  );
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const shopRaw = url.searchParams.get("shop") || "";
  const host = url.searchParams.get("host") || null;
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const hmac = url.searchParams.get("hmac") || "";

  const queryKeys = Array.from(url.searchParams.keys());

  const shop = normalizeShop(shopRaw);

  console.log("[Shopify Callback] incoming", {
    shop,
    hostPresent: !!host,
    codePresent: !!code,
    statePresent: !!state,
    hmacPresent: !!hmac,
    queryKeys,
  });

  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or missing ?shop (expected *.myshopify.com)" },
      { status: 400 }
    );
  }
  if (!code) {
    return NextResponse.json({ ok: false, error: "Missing ?code", queryKeys }, { status: 400 });
  }
  if (!state) {
    return NextResponse.json({ ok: false, error: "Missing ?state", queryKeys }, { status: 400 });
  }

  if (!hmac) {
    return NextResponse.json({ ok: false, error: "Missing ?hmac", queryKeys }, { status: 400 });
  }

  // 1) state-cookie prüfen (CSRF)
  const stateCookie = (req.cookies.get("shopify_oauth_state")?.value || "").trim();
  if (!stateCookie || stateCookie !== state) {
    console.error("[Shopify Callback] state mismatch", {
      shop,
      stateCookiePresent: !!stateCookie,
      statePresent: !!state,
    });
    return NextResponse.json({ ok: false, error: "Invalid state" }, { status: 400 });
  }

  // 2) HMAC prüfen (Query-HMAC)
  const secret = getClientSecret();
  const h = verifyShopifyOauthHmac(url.searchParams, secret);
  if (!h.ok) {
    console.error("[Shopify Callback] HMAC failed", { shop, reason: h.reason });
    return NextResponse.json({ ok: false, error: "Invalid HMAC" }, { status: 400 });
  }

  // 3) Token exchange
  const clientId = getClientId();
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "Missing env: SHOPIFY_API_KEY" },
      { status: 500 }
    );
  }
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Missing env: SHOPIFY_API_SECRET (or SHOPIFY_CLIENT_SECRET)" },
      { status: 500 }
    );
  }

  let token: { accessToken: string; scope?: string };
  try {
    token = await exchangeShopifyAccessToken({
      shop,
      clientId,
      clientSecret: secret,
      code,
    });
  } catch (e: any) {
    console.error("[Shopify Callback] token exchange error", { shop, error: e?.message || String(e) });
    return NextResponse.json({ ok: false, error: "Token exchange failed" }, { status: 500 });
  }

  // 4) In Supabase speichern (server-side only)
  const supabase = getEfroSupabaseServerClient();
  if (!supabase) {
    console.error("[Shopify Callback] Supabase server client missing");
    return NextResponse.json({ ok: false, error: "Supabase not available" }, { status: 500 });
  }

  // WICHTIG: access_token darf niemals an Clients geleakt werden.
  // Außerdem: RLS auf efro_shops aktivieren (ansonsten SECURITY-Linter-Error).
  const dbRow: any = {
    shop_domain: shop,
    access_token: token.accessToken,
    scopes: token.scope ?? null,
    shopify_host: host,
    installed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("efro_shops")
    .upsert(dbRow, { onConflict: "shop_domain" });

  if (upsertError) {
    console.error("[Shopify Callback] supabase upsert error", {
      shop,
      error: upsertError.message,
    });
    return NextResponse.json({ ok: false, error: "Failed to store shop token" }, { status: 500 });
  }

  // 5) state-cookie löschen + redirect
    // IMPORTANT: Redirect darf niemals von req.url abhängen (sonst landet man bei localhost:10000).
    const appBaseUrl =
      (process.env.NEXT_PUBLIC_APP_URL ||
        process.env.SHOPIFY_APP_URL ||
        "").trim() || "https://app.avatarsalespro.com";

    const redirectUrl = new URL("/avatar-seller", appBaseUrl);
  redirectUrl.searchParams.set("shop", shop);

  const res = NextResponse.redirect(redirectUrl.toString());
  res.cookies.set("shopify_oauth_state", "", { path: "/", maxAge: 0 });

  console.log("[Shopify Callback] SUCCESS", { shop, scope: token.scope ?? null });

  return res;
}
