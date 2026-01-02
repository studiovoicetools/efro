export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/webhooks/gdpr/customers-data-request/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhookHmac } from "@/lib/shopify/verifyWebhookHmac";

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const ok = verifyShopifyWebhookHmac(req.headers, raw, secret);

  if (!ok) {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
  }

  // TODO: Kundendaten-Export/Lookup (wenn gespeichert)
  return NextResponse.json({ ok: true, topic: "customers/data_request", stub: true });
}
