import { NextResponse } from "next/server";

/**
 * Stub fuer den Shopify "app/uninstalled" Webhook.
 * Supabase ist noch nicht angebunden, daher machen wir hier nur Logging
 * und geben eine erfolgreiche Antwort zurueck.
 */

export async function POST(request: Request) {
  const bodyText = await request.text();
  console.log("[webhooks/app-uninstalled] Stub received payload:", bodyText);

  return NextResponse.json(
    {
      ok: false,
      message:
        "Supabase ist noch nicht konfiguriert. app-uninstalled Webhook laeuft im Stub-Modus.",
    },
    { status: 200 }
  );
}
