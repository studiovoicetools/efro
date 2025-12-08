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

export async function POST(request: NextRequest) {
  try {
    // Supabase Client mit Service Role Key initialisieren
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      console.error("[EFRO shop-settings] Missing SUPABASE envs");
      return NextResponse.json(
        { error: "Supabase is not configured on the server" },
        { status: 500 }
      );
    }

    const supabase = createClient(url, serviceRoleKey);

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
      console.error("[EFRO shop-settings] upsert failed", error);
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

