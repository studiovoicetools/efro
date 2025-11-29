import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/demo/products?category=Elektronik
 * Robust: holt immer 'featuredimage' und mappt zu 'featuredImage'
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  try {
    if (!category) {
      return NextResponse.json({
        success: false,
        message: "Bitte Kategorie angeben, z. B. ?category=Spielzeug",
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Wichtig: wir holen IMMER 'featuredimage' in klein und mappen spÃ¤ter
    const { data, error } = await supabase
      .from("products_demo")
      .select("title, description, price, vendor, featuredimage, handle, sku, inventory, category")
      .eq("category", category)
      .limit(3);

    if (error) throw error;

    const normalized =
      (data || []).map((p: any) => ({
        title: p.title ?? null,
        description: p.description ?? null,
        price: p.price ?? null,
        vendor: p.vendor ?? null,
        handle: p.handle ?? null,
        sku: p.sku ?? null,
        inventory: p.inventory ?? 0,
        category: p.category ?? null,
        // Mapping hier â€“ API gibt 'featuredImage' zurÃ¼ck, DB bleibt 'featuredimage'
        featuredImage: p.featuredimage ?? null,
      })) ?? [];

    return NextResponse.json({ success: true, category, products: normalized });
  } catch (err: any) {
    console.error("âŒ Fehler /api/demo/products:", err.message);
    return NextResponse.json({ success: false, error: err.message });
  }
}
