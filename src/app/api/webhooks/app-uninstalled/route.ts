// src/app/api/webhooks/app-uninstalled/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Verarbeitet "app/uninstalled":
 * - Signatur prÃ¼fen (X-Shopify-Hmac-Sha256)
 * - Shop in DB auf "deaktiviert" setzen / Token lÃ¶schen
 */

function isValidShopifyHmac(req: NextRequest, rawBody: Buffer) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const hmac = req.headers.get("x-shopify-hmac-sha256") || "";
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(digest));
}

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  if (!isValidShopifyHmac(req, raw)) {
    return NextResponse.json({ error: "UngÃ¼ltige Signatur" }, { status: 401 });
  }

  const topic = req.headers.get("x-shopify-topic");
  const shop = req.headers.get("x-shopify-shop-domain");
  const payload = JSON.parse(raw.toString("utf-8"));

  // TODO: Shop in DB deaktivieren, Tokens lÃ¶schen
  console.log("ğŸ§¹ App deinstalliert:", { shop, topic, payload });

  return NextResponse.json({ ok: true });
}

