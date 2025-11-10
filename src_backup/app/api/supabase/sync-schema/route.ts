// src/app/api/supabase/sync-schema/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = "force-dynamic";

// gewünschtes Schema
const requiredColumns = [
  { name: "id", type: "text" },
  { name: "title", type: "text" },
  { name: "handle", type: "text" },
  { name: "description", type: "text" },
  { name: "featuredImage", type: "text" },
];

export async function GET() {
  try {
    // 1️⃣ vorhandene Spalten abrufen
    const { data: columns, error } = await supabase.rpc("get_table_columns", {
      table_name: "products",
    });

    if (error) {
      console.log("⚠️ Keine Funktion get_table_columns gefunden, wird erstellt …");

      // 🔧 Funktion einmalig erstellen
      const { error: fnError } = await supabase.rpc("exec_sql", {
        sql: `
          CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
          RETURNS TABLE(column_name text, data_type text)
          LANGUAGE plpgsql AS $$
          BEGIN
            RETURN QUERY
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = table_name;
          END; $$;
        `,
      });

      if (fnError) throw fnError;

      return NextResponse.json({
        success: false,
        message: "Funktion erstellt. Bitte Route erneut aufrufen.",
      });
    }

    const existingCols = columns.map((c: any) => c.column_name);
    const missing = requiredColumns.filter(c => !existingCols.includes(c.name));

    if (missing.length === 0) {
      return NextResponse.json({ success: true, message: "Schema ist vollständig ✅" });
    }

    // 2️⃣ Fehlende Spalten hinzufügen
    for (const col of missing) {
      const query = `ALTER TABLE products ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`;
      await supabase.rpc("exec_sql", { sql: query });
      console.log(`➕ Spalte hinzugefügt: ${col.name}`);
    }

    return NextResponse.json({
      success: true,
      added: missing.map(m => m.name),
    });
  } catch (err: any) {
    console.error("❌ Schema Sync Fehler:", err.message);
    return NextResponse.json({ success: false, error: err.message });
  }
}
