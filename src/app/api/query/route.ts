// src/app/api/query/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 🔹 Lazy Supabase-Initialisierung erst zur Laufzeit
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Supabase-Umgebungsvariablen fehlen!");
      return NextResponse.json(
        { error: "Supabase environment variables missing" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 🔹 Anfrage auslesen
    const body = await req.json();
    const { q, limit = 10 } = body as { q?: string; limit?: number };

    if (!q) {
      return NextResponse.json({ error: "Kein Suchbegriff angegeben" }, { status: 400 });
    }

    console.log(`🔍 Supabase Query gestartet für: "${q}"`);

    // 🔹 Volltextsuche in Produkten
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("title", `%${q}%`)
      .limit(limit);

    if (error) {
      console.error("❌ Supabase Query Error:", error.message);
      throw error;
    }

    return NextResponse.json({
      success: true,
      query: q,
      results: data || [],
      count: data?.length || 0,
    });
  } catch (err: any) {
    console.error("❌ Query API Fehler:", err);
    return NextResponse.json(
      { error: err.message || "Unbekannter Fehler" },
      { status: 500 }
    );
  }
}
