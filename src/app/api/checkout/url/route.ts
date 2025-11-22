import { NextResponse } from "next/server";

/**
 * Placeholder implementation for checkout URL endpoint.
 * TODO: Wire up Supabase carts table and real checkout URL logic.
 *
 * Aktuell NICHT mit Supabase verbunden, damit der Build auf Render
 * ohne echte Datenbank-Konfiguration funktioniert.
 */

export async function POST(request: Request) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Checkout URL backend is not yet konfiguriert. Bitte Supabase einrichten und src/app/api/checkout/url/route.ts implementieren.",
    },
    { status: 501 }
  );
}
