import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Erstellt eine serverseitige Supabase-Instanz mit stabiler Cookie-Verwaltung.
 * Kompatibel mit @supabase/ssr ≥ 0.0.10 und Next.js 14.
 */
export const createClient = (cookieStore: ReturnType<typeof cookies>) => {
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: CookieOptions) {
        try {
          cookieStore.set(name, value, options);
        } catch {
          // Ignorieren, falls Server Component-Kontext
        }
      },
      remove(name: string, options?: CookieOptions) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {
          // Ignorieren, falls Server Component-Kontext
        }
      },
    },
  });
};
