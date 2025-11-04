// src/app/api/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

const supabase = new SupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Liefert Shop-Daten (Plan, Aktiv-Status etc.)
 * Erwartet Header: x-shop-domain
 */
export async function GET(request: NextRequest) {
  const shop = request.headers.get("x-shop-domain");

  if (!shop) {
    return NextResponse.json({ error: "Shop-Domain fehlt" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shops")
    .select("shop, plan, active, updated_at")
    .eq("shop", shop)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Shop nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ success: true, shop: data });
}
