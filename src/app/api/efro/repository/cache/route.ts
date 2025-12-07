// src/app/api/efro/repository/cache/route.ts
//
// API-Route für Cache-Operationen (serverseitig)

import { NextRequest, NextResponse } from "next/server";
import {
  getCachedResponse,
  upsertCachedResponse,
} from "@/lib/efro/efroSupabaseRepository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopId = searchParams.get("shopId");
    const questionHash = searchParams.get("questionHash");
    const locale = searchParams.get("locale") || "de";

    if (!shopId || !questionHash) {
      return NextResponse.json(
        { ok: false, error: "shopId and questionHash required" },
        { status: 400 }
      );
    }

    const cached = await getCachedResponse({
      shopId,
      questionHash,
      locale,
    });

    return NextResponse.json({
      ok: true,
      cached,
    });
  } catch (error: any) {
    console.error("[efro/repository/cache] GET error", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to get cached response" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shopId,
      questionHash,
      questionText,
      locale,
      replyText,
      products,
    } = body;

    if (!shopId || !questionHash || !replyText) {
      return NextResponse.json(
        { ok: false, error: "shopId, questionHash, and replyText required" },
        { status: 400 }
      );
    }

    await upsertCachedResponse({
      shopId,
      questionHash,
      questionText: questionText || "",
      locale: locale || "de",
      replyText,
      products: products || [],
    });

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("[efro/repository/cache] POST error", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed to upsert cached response" },
      { status: 500 }
    );
  }
}







