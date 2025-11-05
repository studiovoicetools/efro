// src/app/api/shopify-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Shopify → Supabase Synchronisierung über SKU
 * Unterstützt sowohl echte Shopify-Webhook-Struktur als auch manuelle Tests.
 */

export const runtime = "nodejs";

// 🧩 Lazy Supabase-Verbindung mit ENV-Check
function getSupabase() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  console.log("🔍 ENV-Check (Webhook):", {
    SUPABASE_URL: supabaseUrl ? supabaseUrl.slice(0, 30) + "..." : null,
    HAS_KEY: !!supabaseKey,
  });

  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith("http")) {
    console.warn("⚠️ Supabase ENV fehlerhaft — Build-Phase?");
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase nicht initialisiert" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    console.log("📦 Webhook-Payload empfangen:", Object.keys(body));

    // 🔧 Flexible Struktur: funktioniert mit Shopify UND Test-JSON
    const product = body.product || body;
    const variant = product.variants?.[0];
    const sku = variant?.sku;

    if (!sku) {
      console.warn("❌ Keine SKU im Payload:", product);
      return NextResponse.json({ ok: false, error: "SKU fehlt" }, { status: 400 });
    }

    // Produktdaten vorbereiten
    const productData = {
      sku,
      title: product.title || "",
      description: product.body_html || product.description || "",
      price: parseFloat(variant?.price || "0"),
      compare_at_price: parseFloat(variant?.compare_at_price || "0"),
      image_url: product.images?.[0]?.src || "",
      category: product.product_type || "",
      tags: product.tags || "",
      updated_at: new Date().toISOString(),
    };

    console.log("🧩 Supabase Upsert für:", productData);

    // Upsert nach SKU
    const { error } = await supabase
      .from("products")
      .upsert(productData, { onConflict: "sku" });

    if (error) {
      console.error("❌ Supabase-Fehler beim Upsert:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    console.log(`✅ Produkt erfolgreich synchronisiert: ${sku}`);
    return NextResponse.json({ ok: true, sku });
  } catch (err: any) {
    console.error("❌ Webhook Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
