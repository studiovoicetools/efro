export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/webhooks/app-uninstalled/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyShopifyWebhookHmac } from "@/lib/shopify/verifyWebhookHmac";

/**
 * Shopify "app/uninstalled" Webhook.
 * Aktuell Stub: nur Logging + 200 OK.
 * TODO: später Supabase Cleanup (Shop/Settings/Products) nach shop-domain.
 */
export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());

  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || "";
  const ok = verifyShopifyWebhookHmac(req.headers, raw, secret);

  if (!ok) {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 401 });
  }

  // Stub-Logging: nicht kompletten Body spammen
  console.log("[webhooks/app-uninstalled] received", { bytes: raw.length });

  return NextResponse.json(
    { ok: true, topic: "app/uninstalled", stub: true },
    { status: 200 }
  );
}
