// src/app/api/efro/shops/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Liefert eine Liste aller EFRO-Shops aus der Tabelle "efro_shops".
 * Debug/Admin-Endpoint, um schnell zu sehen, was in Supabase steht.
 */
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("efro_shops")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[GET /api/efro/shops] supabase error", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        count: data?.length ?? 0,
        shops: data ?? [],
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[GET /api/efro/shops] unexpected error", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
