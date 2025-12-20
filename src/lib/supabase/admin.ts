import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function createAdminSupabaseClient(): SupabaseClient | null {
  if (adminClient) return adminClient;

  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceRoleKey) {
    console.error("[EFRO SUPABASE ADMIN] Not configured", {
      hasUrl: !!url,
      hasKey: !!serviceRoleKey,
    });
    return null;
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  console.log("[EFRO SUPABASE ADMIN] Client initialised");
  return adminClient;
}

