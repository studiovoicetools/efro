// src/lib/efro/logEventServer.ts

import { getEfroSupabaseServerClient } from "./supabaseServer";

export type EfroEventLogInput = {
  shopDomain?: string | null;
  userText?: string | null;
  intent?: string | null;
  productCount?: number | null;
  plan?: string | null;
  hadError?: boolean | null;
  errorMessage?: string | null;
};

/**
 * Server-seitiger Logging-Helper für EFRO-Events.
 * Kann aus API-Routen (z. B. /api/efro/suggest) aufgerufen werden.
 * 
 * Fehler werden geloggt, aber nicht geworfen, damit die API-Antwort nicht beeinträchtigt wird.
 */
export async function logEfroEventServer(
  input: EfroEventLogInput
): Promise<void> {
  const supabase = getEfroSupabaseServerClient();
  
  if (!supabase) {
    console.warn("[EFRO logEventServer] Supabase not configured – skipping log");
    return;
  }

  try {
    const { data, error } = await supabase
      .from("efro_events")
      .insert({
        shop_domain: input.shopDomain ?? null,
        user_text: input.userText ?? null,
        intent: input.intent ?? null,
        product_count: input.productCount ?? null,
        plan: input.plan ?? null,
        had_error: input.hadError ?? false,
        error_message: input.errorMessage ?? null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[EFRO LogEvent ERROR]", {
        error: error.message,
        payload: input,
      });
      return;
    }

    console.log("[EFRO LogEvent WRITE]", {
      id: data?.id,
      shopDomain: input.shopDomain,
      intent: input.intent,
      productCount: input.productCount,
      hadError: input.hadError,
    });
  } catch (err: any) {
    console.error("[EFRO LogEvent ERROR]", {
      error: err?.message ? String(err.message) : "unknown-error",
      payload: input,
    });
  }
}

