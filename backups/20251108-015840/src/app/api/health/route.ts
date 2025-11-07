// src/app/api/health/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * 🔍 Health Check Endpoint
 * Wird von Render oder externen Monitoren aufgerufen,
 * um die Betriebsfähigkeit der App zu prüfen.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    status: "✅ EFRO service healthy",
    timestamp: new Date().toISOString(),
  });
}
