// src/app/api/shopify-webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Sichere Lazy-Initialisierung von Supabase */
function getSupabase() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  // Debug-Output für Render-Logs
  console.log("🔍 ENV-Check:", {
    SUPABASE_URL: supabaseUrl ? supabaseUrl.slice(0, 30) + "..." : null,
    HAS_KEY: !!supabaseKey,
  });

  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith("http")) {
    console.warn("⚠️ Supabase-Env-Variablen fehlen oder ungültig (Build-Phase).");
    return null;
  }
  return createClient(supabaseUrl, supabaseKey);
}

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "Supabase nicht initialisiert (Build-Phase)" },
      { status: 503 }
    );
  }

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

    console.log("🧩 Supabase Upsert für:", productData);

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
