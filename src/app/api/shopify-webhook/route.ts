import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import crypto from "crypto";


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Shopify Webhook-Verifizierung
    // In Shopify Admin: Webhooks → Create webhook
    // URL: https://deine-domain.com/api/shopify-webhook
    // Event: products/create, products/update, products/delete

    const { id, title, handle, images, variants } = body;

    if (!id) {
      return NextResponse.json({ error: "Invalid product data" }, { status: 400 });
    }

    // Produkt in Supabase speichern/aktualisieren
    const { data, error } = await supabase
      .from('products')
      .upsert({
        shopify_id: id.toString(),
        title,
        handle,
        image_url: images?.[0]?.src || null,
        price: variants?.[0]?.price || '0',
        compare_at_price: variants?.[0]?.compare_at_price || null,
        url: `https://dein-shop.myshopify.com/products/${handle}`,
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    console.log("✅ Product synced to Supabase:", title);
    return NextResponse.json({ success: true, product: data });

  } catch (error) {
    console.error("❌ Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const runtime = "nodejs"; // raw body için güvenli

function safeTimingEqual(a: string, b: string) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: Request) {
  const secret = process.env.SHOPIFY_API_SECRET!;
  const hmacHeader = headers().get("x-shopify-hmac-sha256") || "";
  const topic = headers().get("x-shopify-topic") || "unknown";
  const shop = headers().get("x-shopify-shop-domain") || "unknown";

  // 1) RAW body al
  const rawBody = await req.text();

  // 2) HMAC hesapla
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  // 3) Karşılaştır
  if (!safeTimingEqual(digest, hmacHeader)) {
    return new Response("HMAC verification failed", { status: 401 });
  }

  // 4) Güvenli parse
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = {};
  }

  // 5) Konuya göre işle
  switch (topic) {
    case "products/create":
    case "products/update":
      // TODO: Supabase’e ürün cache yaz / güncelle
      break;
    case "app/uninstalled":
      // TODO: shop’u pasif işaretle
      break;
    default:
      // logla ve geç
      break;
  }

  return new Response("OK", { status: 200 });
}