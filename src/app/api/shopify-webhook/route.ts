import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const topic = request.headers.get("x-shopify-topic") || "unknown";
    const body = await request.json().catch(() => ({}));
    const variant = Array.isArray(body.variants) ? body.variants[0] : undefined;
    const sku = variant?.sku || body?.sku;

    if (!sku) {
      console.warn("❌ SKU fehlt im Webhook-Body:", body);
      return NextResponse.json({ ok: false, error: "SKU fehlt" }, { status: 400 });
    }

    const productData = {
      sku,
      title: body.title || "",
      description: body.body_html || "",
      price: variant?.price ? parseFloat(String(variant.price)) : 0,
      compare_at_price: variant?.compare_at_price ? parseFloat(String(variant.compare_at_price)) : null,
      image_url: Array.isArray(body.images) && body.images[0]?.src ? body.images[0].src : "",
      category: body.product_type || "",
      tags: body.tags || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("products").upsert(productData, { onConflict: "sku" });
    if (error) throw error;

    console.log("✅ Produkt synchronisiert:", sku, []);
    return NextResponse.json({ ok: true, sku, topic });
  } catch (err: any) {
    console.error("❌ Webhook Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
