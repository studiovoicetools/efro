// src/app/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifyHmac(searchParams: URLSearchParams, secret: string) {
  // Shopify HMAC: alles außer hmac/signature alphabetisch sortiert zusammenfügen
  const params: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) {
    if (k !== "hmac" && k !== "signature") params[k] = v;
  }
  const message = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const digest = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  const given = searchParams.get("hmac") || "";
  return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(given, "utf8"));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const shop = sp.get("shop");
  const hmac = sp.get("hmac");

  // Wenn kein HMAC da ist, einfach die App-Startseite (z.B. /admin) anzeigen
  if (!shop || !hmac) {
    return NextResponse.redirect(new URL("/admin", url.origin));
  }

  const secret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || "";
  if (!secret) {
    console.error("❌ SHOPIFY_CLIENT_SECRET fehlt");
    return NextResponse.redirect(new URL("/admin?err=missing_secret", url.origin));
  }

  // HMAC prüfen
  try {
    const ok = verifyHmac(sp, secret);
    if (!ok) {
      console.warn("⚠️ Ungültiges HMAC am Root:", Object.fromEntries(sp.entries()));
      return NextResponse.redirect(new URL("/admin?err=bad_hmac", url.origin));
    }
  } catch (e) {
    console.error("❌ HMAC-Check Fehler:", e);
    return NextResponse.redirect(new URL("/admin?err=hmac_check_failed", url.origin));
  }

  // Minimalen Session-Cookie setzen (Shop & Host), 1 Tag gültig
  const res = NextResponse.redirect(new URL(`/admin?shop=${shop}`, url.origin));
  const host = sp.get("host") || "";
  res.cookies.set("efro_shop", shop, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 });
  if (host) res.cookies.set("efro_host", host, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 });

  return res;
}
