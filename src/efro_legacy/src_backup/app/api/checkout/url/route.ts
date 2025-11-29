export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/getSupabaseClient";


export async function POST(req: NextRequest) {
  try {
    const { cartId } = await req.json();
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("carts")
      .select("checkout_url")
      .eq("id", cartId)
      .single();

    if (error) throw error;

    if (!data?.checkout_url)
      return NextResponse.json({ error: "Kein Checkout-Link gefunden" }, { status: 404 });

    return NextResponse.json({ success: true, url: data.checkout_url });
  } catch (err: any) {
    console.error("? Checkout URL Fehler:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


