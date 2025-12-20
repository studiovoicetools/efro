import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// -----------------------------------------------------
// Supabase Setup (runtime-safe: NO top-level createClient / NO top-level env crash)
// -----------------------------------------------------

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

function getSupabaseCreds() {
  const url = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");

  // Server-only first: Service key (your preferred name), then legacy fallbacks
  const key =
    env("SUPABASE_SERVICE_KEY") ||
    env("SUPABASE_SERVICE_ROLE_KEY") ||
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return { url, key };
}

function createSupabaseOrNull() {
  const { url, key } = getSupabaseCreds();
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// -----------------------------------------------------
// GET /api/demo-products
// -----------------------------------------------------

export async function GET() {
  try {
    const supabase = createSupabaseOrNull();

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: "missing SUPABASE_URL / SUPABASE_SERVICE_KEY",
        },
        { status: 500 }
      );
    }

    // -----------------------------------------------------
    // Only select columns that exist:
    // id, category, title, description, price
    // -----------------------------------------------------

    const { data, error } = await supabase
      .from("products_demo")
      .select("id, category, title, description, price")
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: `Supabase error: ${error.message}` },
        { status: 500 }
      );
    }

    const products = (data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      price: row.price,
      available: true,

      // Shopify-like placeholders
      handle: String(row.id),
      imageUrl: null,
      imageAlt: row.title,
      compareAtPrice: null,
      url: "#",
    }));

    // Extra: product_details for Agent / tools
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
    return NextResponse.json(
      {
        success: false,
        error: `Server error: ${err?.message || String(err)}`,
      },
      { status: 500 }
    );
  }
}
