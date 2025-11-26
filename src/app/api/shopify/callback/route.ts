// src/app/api/shopify/callback/route.ts

import { NextRequest, NextResponse } from "next/server";

/**
 * Minimaler Shopify-OAuth-Callback:
 * - Wird von Shopify nach der Installation aufgerufen
 * - Liest die wichtigsten Query-Parameter (shop, host, code, state)
 * - Loggt einmal alles
 * - Leitet den Nutzer in deinen Avatar-Seller weiter: /avatar-seller?shop=...
 *
 * HINWEIS:
 * Hier findet NOCH KEIN Token-Exchange statt.
 * Das ist erstmal nur ein technischer Einstiegspunkt.
 */

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  console.log("[Shopify Callback] incoming", {
    shop,
    host,
    codePresent: !!code,
    state,
  });

  if (!shop) {
    return NextResponse.json(
      { ok: false, error: "Missing ?shop parameter" },
      { status: 400 }
    );
  }

  // TODO (später):
  // - HMAC prüfen
  // - code -> AccessToken tauschen
  // - Shop in efro_shops speichern / updaten

  // Für jetzt: Nutzer direkt in deinen Avatar-Seller schicken
  const redirectUrl = new URL("/avatar-seller", url);
  redirectUrl.searchParams.set("shop", shop);

  return NextResponse.redirect(redirectUrl.toString());
}

// wichtig, damit Next.js die Route nicht cached
export const dynamic = "force-dynamic";
