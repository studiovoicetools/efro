// src/app/api/efro/admin/update-plan/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/**
 * Body-Schema:
 * {
 *   "shopDomain": "test-shop.myshopify.com",
 *   "plan": "starter" | "pro" | "enterprise",   // optional, aber mindestens eins von plan / onboardingStatus
 *   "onboardingStatus": "demo" | "live"        // optional
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const shopDomain = String(body.shopDomain || "").trim().toLowerCase();
    const plan = body.plan ? String(body.plan).trim().toLowerCase() : undefined;
    const onboardingStatus = body.onboardingStatus
      ? String(body.onboardingStatus).trim().toLowerCase()
      : undefined;

    if (!shopDomain) {
      return NextResponse.json(
        { ok: false, error: "shopDomain ist erforderlich" },
        { status: 400 }
      );
    }

    if (!plan && !onboardingStatus) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Es muss mindestens eines gesetzt werden: plan oder onboardingStatus",
        },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const updateFields: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (plan) {
      // du kannst hier optional auf erlaubte Werte einschränken
      updateFields.plan = plan;
    }

    if (onboardingStatus) {
      updateFields.onboarding_status = onboardingStatus;
    }

    const { data, error } = await supabase
      .from("efro_shops")
      .update(updateFields)
      .eq("shop_domain", shopDomain)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[efro/admin/update-plan] supabase error", {
        shopDomain,
        error: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          ok: false,
          error: `Kein Shop mit shop_domain='${shopDomain}' gefunden`,
        },
        { status: 404 }
      );
    }

    console.log("[efro/admin/update-plan] updated", {
      shopDomain,
      plan: data.plan,
      onboarding_status: data.onboarding_status,
    });

    return NextResponse.json({
      ok: true,
      shopDomain,
      plan: data.plan,
      onboardingStatus: data.onboarding_status,
      shop: data,
    });
  } catch (err) {
    console.error("[efro/admin/update-plan] unknown error", err);
    return NextResponse.json(
      { ok: false, error: "Unexpected server error" },
      { status: 500 }
    );
  }
}

// wichtig: keine Caches für Admin-API
export const dynamic = "force-dynamic";
