import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/getSupabaseClient";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { sku } = await req.json();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("cross_sell_skus", `%${sku}%`)
      .limit(5);

    if (error) throw error;

    return NextResponse.json({ success: true, related: data });
  } catch (err: any) {
    console.error("❌ Cross-sell Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
