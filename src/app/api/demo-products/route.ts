import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------
// Supabase Setup
// -----------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Service Role hat Vorrang (wegen voller Rechte)
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ SUPABASE_URL oder SUPABASE_KEY nicht gesetzt!");
}

const supabase =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// -----------------------------------------------------
// GET /api/demo-products
// -----------------------------------------------------

export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Supabase ist nicht konfiguriert. Bitte SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY setzen.",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // WIR FRAGEN NUR SPALTEN AB, DIE ES WIRKLICH GIBT:
    // id, category, title, description, price
    // -----------------------------------------------------

    const { data, error } = await supabase
      .from("products_demo")
      .select("id, category, title, description, price")
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      console.error("❌ Supabase Fehler:", error);
      return NextResponse.json(
        {
          success: false,
          error: `Supabase-Fehler: ${error.message}`,
        },
        { status: 500 }
      );
    }

    const products = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: row.price,
      available: true,
      // Shopify-API verlangt Felder – wir liefern Dummy/Platzhalter
      handle: row.id,
      imageUrl: null,
      imageAlt: row.title,
      compareAtPrice: null,
      url: "#",
    }));

    // -----------------------------------------------------
    // Extra: product_details für ElevenLabs Agent
    // -----------------------------------------------------
    const product_details = products.map((p) => ({
      title: p.title,
      description: p.description,
      price: p.price,
      available: p.available,
      category: p.category,
      image_url: null,
      url: "#",
    }));

    return NextResponse.json({
      success: true,
      products,
      product_details,
    });
  } catch (err: any) {
    console.error("❌ API /demo-products Fehler:", err);
    return NextResponse.json(
      {
        success: false,
        error: `Serverfehler: ${err?.message || String(err)}`,
      },
      { status: 500 }
    );
  }
}
