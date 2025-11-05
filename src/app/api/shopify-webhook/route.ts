// src/app/api/shopify-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Shopify → Supabase Synchronisierung über SKU
 * Wird aufgerufen, wenn ein Produkt erstellt oder aktualisiert wird.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const variant = body.variants?.[0];

    const sku = variant?.sku;
    if (!sku) {
      console.warn("❌ Keine SKU im Webhook gefunden:", body);
      return NextResponse.json({ ok: false, error: "SKU fehlt" }, { status: 400 });
    }

    const productData = {
      sku,
      title: body.title || "",
      description: body.body_html || "",
      price: parseFloat(variant?.price || "0"),
      compare_at_price: parseFloat(variant?.compare_at_price || "0"),
      image_url: body.images?.[0]?.src || "",
      category: body.product_type || "",
      tags: body.tags || "",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("products")
      .upsert(productData, { onConflict: "sku" });

    if (error) {
      console.error("❌ Supabase Sync Error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log(`✅ Produkt synchronisiert: ${sku}`);
    return NextResponse.json({ ok: true, sku });
  } catch (err: any) {
    console.error("❌ Webhook Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export const runtime = "nodejs";
