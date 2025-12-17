import { DEFAULT_STORE_FACTS, type StoreFacts } from "./storeFacts";

/**
 * Abstraktion: Heute (v1) noch ohne echten DB-Write.
 * In Schritt X hängen wir Supabase sauber dran.
 * Wichtig: pro Shop getrennt.
 */
export type ShopId = string;

export type ShopKbBundle = {
  shopId: ShopId;
  facts: StoreFacts;
  updatedAt: string; // ISO
  source: "default" | "manual" | "scan";
};

/**
 * V1: Placeholder Loader (No-Op). Liefert immer Default.
 * Das ist absichtlich, damit wir nichts kaputt machen.
 */
export async function loadShopKb(shopId: ShopId): Promise<ShopKbBundle> {
  return {
    shopId,
    facts: DEFAULT_STORE_FACTS,
    updatedAt: new Date(0).toISOString(),
    source: "default",
  };
}

/**
 * V1: Placeholder Saver (No-Op).
 * Später: supabase upsert nach shop_kb_facts.
 */
export async function saveShopKb(_bundle: ShopKbBundle): Promise<void> {
  return;
}
