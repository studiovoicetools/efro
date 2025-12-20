import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { jsonUtf8 } from "@/lib/http/jsonUtf8";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/**
 * WICHTIG:
 * - Kein createClient() auf Module-Top-Level
 * - Kein Throw beim Import (sonst Render/Next Build "Collecting page data" crash)
 * - Optional: Gate, damit Route in Prod nur bewusst nutzbar ist
 */

function env(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function getAdminClientOrError() {
  // Canonical: du kannst SUPABASE_URL setzen ODER NEXT_PUBLIC_SUPABASE_URL verwenden
  const url = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");

  // Canonical Admin-Key in deinem Projekt: SUPABASE_SERVICE_KEY
  // Fallbacks nur für Legacy/Kompatibilität
  const key =
    env("SUPABASE_SERVICE_KEY") ??
    env("SUPABASE_SERVICE_ROLE_KEY") ??
    env("SUPABASE_KEY") ??
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !key) {
    return {
      supabase: null as ReturnType<typeof createClient> | null,
      error: {
        message: "missing SUPABASE env",
        missing: {
          url: !url,
          key: !key,
        },
        hint:
          "Setze in Render mindestens NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY (und für Admin: SUPABASE_SERVICE_KEY).",
      },
    };
  }

  return {
    supabase: createClient(url, key, {
      auth: { persistSession: false },
    }),
    error: null as any,
  };
}

export async function GET(req: NextRequest) {
  // Optional: harte Sicherung, damit das Ding in Prod nicht versehentlich läuft
  // Setze ENABLE_SUPABASE_SYNC_SCHEMA=1 nur wenn du es wirklich nutzen willst
  const enabled = env("ENABLE_SUPABASE_SYNC_SCHEMA") === "1";
  if (!enabled) {
    return jsonUtf8(
      { ok: false, error: "sync-schema disabled" },
      { status: 404 }
    );
  }

  const { supabase, error } = getAdminClientOrError();
  if (!supabase) {
    // KEIN Throw -> Build-sicher
    return jsonUtf8({ ok: false, ...error }, { status: 500 });
  }

  try {
    // ✅ HIER kommt dein bestehender Sync/Schema-Code rein.
    // Wichtig: alles innerhalb von try/catch, nix auf Top-Level.

    // Platzhalter, damit du direkt bauen kannst:
    return jsonUtf8({ ok: true, note: "sync-schema route reachable" });
  } catch (e: any) {
    return jsonUtf8(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
