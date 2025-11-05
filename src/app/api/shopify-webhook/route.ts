// src/app/api/shopify-webhook/route.ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Minimaler Shopify Webhook Handler (Build-sicher)
 * - Nimmt JSON entgegen
 * - Gibt 200 zurück
 * - Keine doppelte POST-Definition
 */
export async function POST(req: Request) {
  try {
    const topic = headers().get("x-shopify-topic") || "unknown";
    const body = await req.json().catch(() => ({}));
    console.log("📦 Webhook:", topic, "payload keys:", Object.keys(body));

    // TODO: Später HMAC prüfen & Supabase upsert einbauen
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
