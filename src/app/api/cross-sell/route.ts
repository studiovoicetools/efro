import { NextResponse } from "next/server";

/**
 * Placeholder cross-sell API.
 * TODO: Spaeter mit echtem Supabase / Cross-Sell-Backend ersetzen.
 */

export async function GET(request: Request) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Cross-sell Backend ist noch nicht konfiguriert. Bitte Supabase anbinden und src/app/api/cross-sell/route.ts implementieren.",
      items: [],
    },
    { status: 501 }
  );
}

export async function POST(request: Request) {
  return NextResponse.json(
    {
      ok: false,
      error:
        "Cross-sell Backend ist noch nicht konfiguriert. Bitte Supabase anbinden und src/app/api/cross-sell/route.ts implementieren.",
      items: [],
    },
    { status: 501 }
  );
}
