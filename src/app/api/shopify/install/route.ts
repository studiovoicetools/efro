// src/app/api/shopify/install/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const OAUTH_STATE_COOKIE = "efro_shopify_oauth_state";
const STATE_MAX_AGE_SEC = 600; // 10 min

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

function getAppUrl(req: NextRequest): string {
  const envUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const proto = isHttps(req) ? "https" : "http";
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function getShopifyClientId(): string {
  return (process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || "").trim();
}

function getShopifySecret(): string {
  return (process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || "").trim();
}

function signState(shop: string, nonce: string, ts: string, secret: string): string {
  const payload = `${shop}|${nonce}|${ts}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

function createSignedState(shop: string, secret: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString(36);
  const sig = signState(shop, nonce, ts, secret);
  return `${ts}.${nonce}.${sig}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawShop = url.searchParams.get("shop") || "";
  const shop = normalizeShopToMyshopify(rawShop);

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing/invalid ?shop" }, { status: 400 });
  }

  const clientId = getShopifyClientId();
  if (!clientId) {
    return NextResponse.json(
      { ok: false, error: "Missing env: SHOPIFY_CLIENT_ID/SHOPIFY_API_KEY" },
      { status: 500 }
    );
  }

  const appUrl = getAppUrl(req);
  const redirectUri = `${appUrl}/api/shopify/callback`;

  const scopes =
    (process.env.SHOPIFY_SCOPES || "read_products")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(",");

  const secret = getShopifySecret();
  const state = secret ? createSignedState(shop, secret) : crypto.randomBytes(16).toString("hex");

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("scope", scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  console.log("[Shopify Install] redirecting", {
    shop,
    redirectUri,
    scopesCount: scopes ? scopes.split(",").length : 0,
    statePresent: !!state,
    sameSite: "none",
  });

  const res = NextResponse.redirect(authUrl.toString(), 307);

  // SameSite=None (Shopify Admin fetch/XHR friendly), but callback won't depend on cookie anymore.
  res.cookies.set({
    name: OAUTH_STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: STATE_MAX_AGE_SEC,
  });

  return res;
}
