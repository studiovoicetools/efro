// src/lib/shops/db.ts

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export type ShopMetaFromDb = {
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
 * Holt Shop-Metadaten aus der Supabase-Datenbank.
 * Gibt null zurück, wenn kein Eintrag gefunden wird oder ein Fehler auftritt.
 */
export async function getShopMetaFromDb(
  shopDomain: string
): Promise<ShopMetaFromDb | null> {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from("efro_shops")
      .select("*")
      .eq("shop_domain", shopDomain)
      .maybeSingle();

    if (error) {
      console.error("[getShopMetaFromDb] error", {
        shopDomain,
        error: error.message,
      });
      return null;
    }

    if (!data) {
      return null;
    }

    // Normalisiere DB-Felder zu unserem ShopMetaFromDb-Format
    return {
      shopDomain: data.shop_domain ?? shopDomain,
      brandName: data.brand_name ?? undefined,
      mainCategory: data.main_category ?? undefined,
      targetAudience: data.target_audience ?? undefined,
      priceLevel: data.price_level ?? undefined,
      language: data.language ?? undefined,
      country: data.country ?? undefined,
      currency: data.currency ?? undefined,
      toneOfVoice: data.tone_of_voice ?? undefined,
      plan: data.plan ?? undefined,
    };
  } catch (error) {
    console.error("[getShopMetaFromDb] error", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
// src/lib/shops/db.ts (am Ende hinzufügen)

export async function touchShopLastSeen(shopDomain: string): Promise<void> {
  try {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase
      .from("efro_shops")
      .update({
        last_seen_at: new Date().toISOString(),
      })
      .eq("shop_domain", shopDomain);

    if (error) {
      console.error("[touchShopLastSeen] error", {
        shopDomain,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("[touchShopLastSeen] unexpected error", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
