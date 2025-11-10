// src/lib/getSupabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Supabase-Umgebungsvariablen fehlen!");
    throw new Error("Supabase environment variables missing");
  }

  return createClient(supabaseUrl, supabaseKey);
}
