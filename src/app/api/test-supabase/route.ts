import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/getSupabaseClient";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("products").select("*").limit(1);

    if (error) throw error;

    return NextResponse.json({ success: true, products: data });
  } catch (err: any) {
    console.error("❌ Test Supabase Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
