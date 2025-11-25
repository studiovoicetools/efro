// src/app/api/efro/onboard-shop/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

type OnboardPayload = {
  shopDomain: string;
  brandName?: string;
  mainCategory?: string;
  targetAudience?: string;
  priceLevel?: string;
  language?: string;
  country?: string;
  currency?: string;
  toneOfVoice?: string;
  plan?: string;
};

/**
 * Normalisiert eine Domain:
 * - trim
 * - lower-case
 */
function normalizeShopDomain(domain: string): string {
  return (domain || "").trim().toLowerCase();
}

/**
 * POST /api/efro/onboard-shop
 *
 * Erwartet JSON-Body:
 * {
 *   "shopDomain": "test-shop.myshopify.com",
 *   "brandName": "Test Shop",
 *   "mainCategory": "Haushalt",
 *   "targetAudience": "Bewusste Online-Käufer",
 *   "priceLevel": "mittel",
 *   "language": "de",
 *   "country": "DE",
 *   "currency": "EUR",
 *   "toneOfVoice": "locker und kompetent",
 *   "plan": "starter"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<OnboardPayload>;

    const rawDomain = body.shopDomain;
    if (!rawDomain || typeof rawDomain !== "string") {
      return NextResponse.json(
        { error: "shopDomain is required" },
        { status: 400 }
      );
    }

    const shopDomain = normalizeShopDomain(rawDomain);

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const payload: OnboardPayload = {
      shopDomain,
      brandName: body.brandName,
      mainCategory: body.mainCategory,
      targetAudience: body.targetAudience,
      priceLevel: body.priceLevel,
      language: body.language,
      country: body.country,
      currency: body.currency,
      toneOfVoice: body.toneOfVoice,
      plan: body.plan,
    };

    // Mapping auf DB-Spalten (snake_case)
    const dbRow = {
      shop_domain: payload.shopDomain,
      brand_name: payload.brandName ?? null,
      main_category: payload.mainCategory ?? null,
      target_audience: payload.targetAudience ?? null,
      price_level: payload.priceLevel ?? null,
      language: payload.language ?? null,
      country: payload.country ?? null,
      currency: payload.currency ?? null,
      tone_of_voice: payload.toneOfVoice ?? null,
      plan: payload.plan ?? null,
    };

    console.log("[onboard-shop] UPSERT", dbRow);

    const { data, error } = await supabase
      .from("efro_shops")
      .upsert(dbRow, {
        onConflict: "shop_domain",
      })
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[onboard-shop] Supabase error", {
        shopDomain,
        error: error.message,
      });
      return NextResponse.json(
        { error: "Failed to upsert shop meta" },
        { status: 500 }
      );
    }

    console.log("[onboard-shop] SUCCESS", { shopDomain, data });

    return NextResponse.json(
      {
        ok: true,
        shopDomain,
        data,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[onboard-shop] Unhandled error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unexpected error in onboard-shop" },
      { status: 500 }
    );
  }
}

// Kein Caching für diese Route
export const dynamic = "force-dynamic";
