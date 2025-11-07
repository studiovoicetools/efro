import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/getSupabaseClient";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from("users").select("*").limit(10);

    if (error) throw error;

    return NextResponse.json({ success: true, users: data });
  } catch (err: any) {
    console.error("❌ /api/me Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
