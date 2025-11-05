// src/app/api/shopify-webhook/route.ts
import { NextRequest, NextResponse, headers } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "nodejs";

// 🧩 Supabase-Verbindung
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🧩 Hilfsfunktion für sichere HMAC-Prüfung
function safeTimingEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

// 🧾 Haupt-Webhook-Handler
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.SHOPIFY_API_SECRET!;
    const hmacHeader = headers().get("x-shopify-hmac-sha256") || "";
    const topic = headers().get("x-shopify-topic") || "unknown";
    const bodyText = await request.text();

    // 🧮 HMAC-Überprüfung
    const generatedHmac = crypto
      .createHmac("sha256", secret)
      .update(bodyText, "utf8")
      .digest("base64");

    if (!safeTimingEqual(generatedHmac, hmacHeader)) {
      console.error("❌ Ungültige HMAC-Signatur für", topic);
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    console.log(`📦 Webhook empfangen: ${topic}`);

    // Nur Produkt-Events verarbeiten
    if (["products/create", "products/update", "products/delete"].includes(topic)) {
      const { id, title, handle, images, variants } = body;
      if (!id) {
        return NextResponse.json({ error: "Invalid product data" }, { status: 400 });
      }

      // 🔄 Produkt speichern/aktualisieren
      const { error } = await supabase
        .from("products")
        .upsert({
          shopify_id: id.toString(),
          title,
          handle,
          image_url: images?.[0]?.src || null,
          price: variants?.[0]?.price || "0",
          compare_at_price: variants?.[0]?.compare_at_price || null,
          url: `https://dein-shop.myshopify.com/products/${handle}`,
          updated_at: new Date().toISOString(),
        });

      if (error) {
        console.error("❌ Supabase-Fehler:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      console.log("✅ Produkt erfolgreich synchronisiert:", title);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Webhook-Fehler:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
