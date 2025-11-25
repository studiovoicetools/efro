// src/lib/shops/meta.ts

import { getShopMetaFromDb } from "./db";

export type ShopMeta = {
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

const DEFAULT_META: ShopMeta = {
  shopDomain: "local-dev",
  brandName: "EFRO Demo Shop",
  mainCategory: "Allgemeine Produkte",
  targetAudience: "Online-Käufer",
  priceLevel: "mittel",
  language: "de",
};

// Statische Fallback-Daten für bekannte Test-Shops
const SHOP_META: Record<string, ShopMeta> = {
  "local-dev": {
    ...DEFAULT_META,
  },
  // Beispiel: Demo-Shop für Snowboards
  "snow-demo.myshopify.com": {
    shopDomain: "snow-demo.myshopify.com",
    brandName: "Snow Demo",
    mainCategory: "Snowboards und Zubehör",
    targetAudience: "Hobby- und Pro-Fahrer",
    priceLevel: "mittel bis hoch",
    language: "de",
  },
};

/**
 * Holt Shop-Metadaten mit folgender Priorität:
 * 1. Supabase-Datenbank (efro_shops)
 * 2. Statische SHOP_META-Map
 * 3. Fallback zu "local-dev" Defaults
 *
 * Gibt immer ein gültiges ShopMeta-Objekt zurück (nie null).
 */
export async function getShopMeta(shopDomain: string): Promise<ShopMeta> {
  // Normalisiere Shop-Domain
  const normalizedDomain = shopDomain.trim().toLowerCase();

  // 1. Versuche DB-Lookup
  const dbResult = await getShopMetaFromDb(normalizedDomain);
  if (dbResult) {
    console.log("[getShopMeta] source=db", { shopDomain: normalizedDomain });
    return dbResult;
  }

  // 2. Prüfe statische Map
  if (SHOP_META[normalizedDomain]) {
    console.log("[getShopMeta] source=static", {
      shopDomain: normalizedDomain,
    });
    return SHOP_META[normalizedDomain];
  }

  // 3. Fallback zu "local-dev" Defaults, aber mit echtem Shop-Domain
  console.log("[getShopMeta] source=fallback", {
    shopDomain: normalizedDomain,
  });
  return {
    ...DEFAULT_META,
    shopDomain: normalizedDomain || "local-dev",
  };
}