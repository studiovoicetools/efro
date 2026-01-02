export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/webhooks/gdpr/shop-redact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhookHmac } from "@/lib/shopify/verifyWebhookHmac";

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const ok = verifyShopifyWebhookHmac(req.headers, raw, secret);

  if (!ok) {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
  }

  // TODO: Shop-Daten löschen/anonymisieren (wenn gespeichert)
  return NextResponse.json({ ok: true, topic: "shop/redact", stub: true });
}
