// src/app/api/efro/shop-settings/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

interface ShopSettingsPayload {
  shop: string;
  avatarId?: string;
  voiceId?: string;
  locale?: string;
  ttsEnabled?: boolean;
}

// Helper function to create Supabase client with service role key
function createServiceRoleClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.error("[EFRO shop-settings] Missing Supabase envs", {
      urlDefined: !!url,
      serviceRoleDefined: !!serviceRoleKey,
      urlLength: url?.length ?? 0,
      serviceRoleLength: serviceRoleKey?.length ?? 0,
    });
    return null;
  }

  return createClient(url, serviceRoleKey);
}

export async function GET(request: NextRequest) {
  try {
    // Parse shop query parameter
    const { searchParams } = new URL(request.url);
    const shopParam = (searchParams.get("shop") ?? "").trim();

    if (!shopParam) {
      return NextResponse.json(
        { error: "Missing 'shop' query parameter" },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured on the server" },
        { status: 500 }
      );
    }

    // Query settings for the shop
    const { data, error } = await supabase
      .from("efro_shop_settings")
      .select("*")
      .eq("shop", shopParam)
      .maybeSingle();

    if (error) {
      console.error("[EFRO shop-settings] GET failed", {
        error,
        shop: shopParam,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
      });
      return NextResponse.json(
        { error: "Failed to fetch shop settings", details: error.message },
        { status: 500 }
      );
    }

    if (data === null) {
      return NextResponse.json(
        { error: "Shop settings not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ settings: data }, { status: 200 });
  } catch (error: any) {
    console.error("[EFRO shop-settings] GET unexpected error", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = createServiceRoleClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase is not configured on the server" },
        { status: 500 }
      );
    }

    // Request Body parsen und validieren
    const body: ShopSettingsPayload = await request.json();
    const shop = (body.shop ?? "").trim();

    if (!shop) {
      return NextResponse.json(
        { error: "Missing 'shop' in request body" },
        { status: 400 }
      );
    }

    // UPSERT in efro_shop_settings
    const { data, error } = await supabase
      .from("efro_shop_settings")
      .upsert(
        {
          shop,
          avatar_id: body.avatarId ?? null,
          voice_id: body.voiceId ?? null,
          locale: body.locale ?? null,
          tts_enabled:
            typeof body.ttsEnabled === "boolean" ? body.ttsEnabled : true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "shop" }
      )
      .select()
      .single();

    if (error) {
      console.error("[EFRO shop-settings] upsert failed", {
        error,
        shop,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        payload: {
          shop,
          avatar_id: body.avatarId ?? null,
          voice_id: body.voiceId ?? null,
          locale: body.locale ?? null,
          tts_enabled: typeof body.ttsEnabled === "boolean" ? body.ttsEnabled : true,
        },
      });
      return NextResponse.json(
        { error: "Failed to save shop settings", details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, settings: data },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[EFRO shop-settings] Unexpected error", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

