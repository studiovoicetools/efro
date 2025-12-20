// src/lib/efro/supabaseServer.ts

import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Erstellt einen Supabase-Client fÃ¼r EFRO-Server-Routen.
 * Verwendet SUPABASE_URL und SUPABASE_SERVICE_KEY (Fallback: SUPABASE_SERVICE_ROLE_KEY).
 * 
 * @returns SupabaseClient oder null, falls ENV-Variablen nicht gesetzt sind
 */
export function getEfroSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

