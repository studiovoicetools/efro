// src/app/api/shopify/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

const OAUTH_STATE_COOKIE = "efro_shopify_oauth_state";

function normalizeShopToMyshopify(raw: string): string | null {
  const s = (raw || "").trim().toLowerCase();

  const m = s.match(/^admin\.shopify\.com\/store\/([^/?#]+)/i);
  if (m?.[1]) return `${m[1]}.myshopify.com`;

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

function buildHmacMessage(searchParams: URLSearchParams): string {
  const pairs: Array<[string, string]> = [];
  for (const [k, v] of searchParams.entries()) {
    if (k === "hmac" || k === "signature") continue;
    pairs.push([k, v]);
  }
  pairs.sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

function safeEqualHex(a: string, b: string): boolean {
  // compare hex strings in constant time
  const aa = (a || "").trim().toLowerCase();
  const bb = (b || "").trim().toLowerCase();
  const bufA = Buffer.from(aa, "utf8");
  const bufB = Buffer.from(bb, "utf8");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || "";
  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  }
  return createSupabaseAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function exchangeCodeForToken(shop: string, code: string) {
  const clientId = process.env.SHOPIFY_CLIENT_ID || process.env.SHOPIFY_API_KEY || "";
  const clientSecret =
    process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing env: SHOPIFY_CLIENT_ID/SHOPIFY_API_KEY or SHOPIFY_CLIENT_SECRET/SHOPIFY_API_SECRET"
    );
  }

  const tokenUrl = `https://${shop}/admin/oauth/access_token`;
  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Token exchange failed (${resp.status}): ${text.slice(0, 400)}`);
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Token exchange returned non-JSON: ${text.slice(0, 400)}`);
  }

  const accessToken = json?.access_token;
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token exchange response missing access_token");
  }

  return { accessToken, raw: json };
}

async function saveTokenToShopsTable(shop: string, accessToken: string) {
  const supabase = getSupabaseAdmin();

  // Robust: avoid relying on unique constraint (select -> update/insert)
  const { data: existing, error: selErr } = await supabase
    .from("shops")
    .select("*")
    .eq("shop", shop)
    .maybeSingle();

  if (selErr) {
    console.error("[Shopify Callback] shops select error (continuing)", {
      shop,
      error: selErr.message,
    });
  }

  const now = new Date().toISOString();

  if (existing) {
    const { data, error } = await supabase
      .from("shops")
      .update({ access_token: accessToken, updated_at: now })
      .eq("shop", shop)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`shops update failed: ${error.message}`);
    return data;
  }

  const { data, error } = await supabase
    .from("shops")
    .insert([{ shop, access_token: accessToken, updated_at: now }])
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`shops insert failed: ${error.message}`);
  return data;
}

async function ensureEfroShopExists(shop: string) {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("efro_shops")
    .upsert(
      {
        shop_domain: shop,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "shop_domain" }
    )
    .select("*")
    .maybeSingle();

  if (error) throw new Error(`efro_shops upsert failed: ${error.message}`);
  return data;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const rawShop = url.searchParams.get("shop") || "";
  const shop = normalizeShopToMyshopify(rawShop);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const hmac = url.searchParams.get("hmac");
  const host = url.searchParams.get("host");

  console.log("[Shopify Callback] incoming", {
    shop,
    hostPresent: !!host,
    codePresent: !!code,
    statePresent: !!state,
    hmacPresent: !!hmac,
  });

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Missing/invalid ?shop" }, { status: 400 });
  }
  if (!code || !state || !hmac) {
    return NextResponse.json(
      { ok: false, error: "Missing required params (need shop+code+state+hmac)" },
      { status: 400 }
    );
  }

  // 1) state check
  const cookieState = req.cookies.get(OAUTH_STATE_COOKIE)?.value || "";
  if (!cookieState || cookieState !== state) {
    console.error("[Shopify Callback] state mismatch", {
      shop,
      cookieStatePresent: !!cookieState,
      statePresent: !!state,
    });
    return NextResponse.json({ ok: false, error: "Invalid state" }, { status: 400 });
  }

  // 2) hmac check
  const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || "";
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Missing env: SHOPIFY_CLIENT_SECRET/SHOPIFY_API_SECRET" },
      { status: 500 }
    );
  }

  const message = buildHmacMessage(url.searchParams);
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");

  if (!safeEqualHex(digest, hmac)) {
    console.error("[Shopify Callback] hmac invalid", {
      shop,
      messagePreview: message.slice(0, 160),
      digestPreview: digest.slice(0, 12),
    });
    return NextResponse.json({ ok: false, error: "Invalid hmac" }, { status: 400 });
  }

  // 3) exchange code -> token
  let accessToken = "";
  try {
    const out = await exchangeCodeForToken(shop, code);
    accessToken = out.accessToken;

    console.log("[Shopify Callback] token exchange OK", {
      shop,
      tokenLen: accessToken.length,
      scope: out.raw?.scope,
    });
  } catch (e) {
    console.error("[Shopify Callback] token exchange FAILED", {
      shop,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, error: "Token exchange failed" }, { status: 500 });
  }

  // 4) save token (shops) + ensure efro_shops exists
  try {
    const saved = await saveTokenToShopsTable(shop, accessToken);
    console.log("[Shopify Callback] token SAVED (shops)", {
      shop,
      hasAccessToken: !!saved?.access_token,
    });

    const efroRow = await ensureEfroShopExists(shop);
    console.log("[Shopify Callback] shop UPSERTED (efro_shops)", {
      shop,
      efroShopId: efroRow?.id ?? null,
    });
  } catch (e) {
    console.error("[Shopify Callback] save FAILED", {
      shop,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: false, error: "Failed to save token" }, { status: 500 });
  }

  // 5) redirect to app
  const redirectUrl = new URL("/avatar-seller", url);
  redirectUrl.searchParams.set("shop", shop);
  redirectUrl.searchParams.set("oauth", "ok");

  const res = NextResponse.redirect(redirectUrl.toString());

  // clear state cookie
  res.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

export const dynamic = "force-dynamic";
