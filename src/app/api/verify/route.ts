export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get("shop");
  if (!shop) return NextResponse.json({ ok: false, error: "Missing shop" }, { status: 400 });
  return NextResponse.json({ ok: true, shop });
}

export const runtime = "nodejs";

