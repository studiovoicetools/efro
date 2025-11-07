export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  console.log("📦 Supabase Products API aufgerufen");

  try {
    // Supabase Client initialisieren
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Produkte abrufen
    let { data: products, error } = await supabase
      .from("products")
      .select("*")
      .limit(50);

    if (error) {
      console.error("❌ Supabase-Fehler:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ ${products?.length || 0} Produkte gefunden.`);
    return NextResponse.json({
      success: true,
      products: products || [],
      total: products?.length || 0,
    });
  } catch (err: any) {
    console.error("❌ API-Fehler:", err.message);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}


