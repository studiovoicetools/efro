export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/getSupabaseClient";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { shop } = body;
    const supabase = getSupabaseClient();

    await supabase.from("shops").update({ active: false }).eq("shop", shop);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("? Webhook Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


