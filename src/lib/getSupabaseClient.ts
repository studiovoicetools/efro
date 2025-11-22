/**
 * Minimaler Stub fuer Supabase Client, damit Next Build auf Render laeuft.
 * TODO: Spaeter durch echte Supabase Implementierung ersetzen.
 */

export type SupabaseClientLike = any;

let cachedClient: SupabaseClientLike | null = null;

export function getSupabaseClient(): SupabaseClientLike {
  if (!cachedClient) {
    throw new Error("getSupabaseClient() wurde aufgerufen, aber Supabase ist noch nicht konfiguriert. Bitte src/lib/getSupabaseClient.ts implementieren.");
  }
  return cachedClient;
}
