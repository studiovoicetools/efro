export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * PROD-SAFE:
 * - Kein createClient() auf Module-Top-Level (sonst Build-Crash bei fehlenden ENV)
 * - Secret-Guard, damit niemand den Endpoint öffentlich nutzen kann
 */
function getEnv(name: string): string {
  return (process.env[name] || "").trim();
}

function getSupabaseAdmin() {
  const url = getEnv("SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(req: NextRequest) {
  // Secret Guard
  const secret = getEnv("SYNC_SCHEMA_SECRET");
  const provided = req.nextUrl.searchParams.get("secret") || "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" },
      { status: 500 }
    );
  }

  // NOTE: Schema wird ab jetzt professionell per Migration gemacht.
  // Diese Route ist nur noch ein geschütztes Admin-Tool (Smoke/Health).
  return NextResponse.json({
    ok: true,
    note: "Schema handled via migrations. This endpoint is intentionally non-destructive.",
  });
}
