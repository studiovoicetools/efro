// src/app/api/shopify/install/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const OAUTH_STATE_COOKIE = "efro_shopify_oauth_state";

function normalizeShopToMyshopify(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase();

  // Support: admin.shopify.com/store/<handle>
  const m = s.match(/^admin\.shopify\.com\/store\/([^/?#]+)/i);
  if (m?.[1]) return `${m[1]}.myshopify.com`;

  // Standard: <handle>.myshopify.com
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(s)) return s;

  return null;
}

function isHttps(req: NextRequest): boolean {
  const xfProto = req.headers.get("x-forwarded-proto");
  if (xfProto) return xfProto.toLowerCase().includes("https");
  try {
    const u = new URL(req.url);
    return u.protocol === "https:";
  } catch {
    return true;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const rawShop = url.searchParams.get("shop") || "";
  const shop = normalizeShopToMyshopify(rawShop);

  if (!shop) {
    return NextResponse.json(
      { ok: false, error: "Missing/invalid ?shop (expected <handle>.myshopify.com)" },
      { status: 400 }
    );
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || "";
  const scopes =
    process.env.SHOPIFY_APP_SCOPES || process.env.SHOPIFY_SCOPES || "read_products";
  const appUrl = process.env.SHOPIFY_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";

  if (!clientId || !appUrl) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing env: SHOPIFY_CLIENT_ID/SHOPIFY_API_KEY or SHOPIFY_APP_URL/NEXT_PUBLIC_APP_URL",
      },
      { status: 500 }
    );
  }

  const redirectUri = `${appUrl.replace(/\/+$/, "")}/api/shopify/callback`;

  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  console.log("[Shopify Install] redirecting", {
    shop,
    redirectUri,
    scopesCount: scopes.split(",").map(s => s.trim()).filter(Boolean).length,
    statePresent: !!state,
  });

  const res = NextResponse.redirect(authUrl.toString());

  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 min
  });

  return res;
}

export const dynamic = "force-dynamic";
