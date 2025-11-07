export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/webhooks/gdpr/customer-redact/route.ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

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
  // TODO: Kundendaten lÃ¶schen/anonymisieren, falls gespeichert
  return NextResponse.json({ ok: true });
}


