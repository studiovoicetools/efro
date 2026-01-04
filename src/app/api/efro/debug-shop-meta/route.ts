// src/app/api/efro/debug-shop-meta/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Debug-Endpoint, um zu sehen, welche Shop-Metadaten EFRO
 * für einen bestimmten Shop-Domain tatsächlich verwendet.
 *
 * Aufruf:
 *   /api/efro/debug-shop-meta?shop=test-shop.myshopify.com
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shopParam = searchParams.get("shop") || "local-dev";

  const meta = await getShopMeta(shopParam);

  // Token-Proof (ohne Token auszugeben): liest aus Tabelle `shops` (Admin-Key nötig)
  let tokenProof: {
    rowExists: boolean;
    hasToken: boolean;
    updatedAt: string | null;
    error?: string;
  } = {
    rowExists: false,
    hasToken: false,
    updatedAt: null,
  };

  try {
    const admin = createAdminSupabaseClient();
    if (!admin) {
      tokenProof = { ...tokenProof, error: "SUPABASE admin not configured (SUPABASE_URL / SUPABASE_SERVICE_KEY)" };
    } else {
      const { data, error } = await admin
        .from("shops")
        .select("shop, access_token, updated_at")
        .eq("shop", shopParam)
        .maybeSingle();

      if (error) {
        tokenProof = { ...tokenProof, error: error.message };
      } else if (!data) {
        tokenProof = { rowExists: false, hasToken: false, updatedAt: null };
      } else {
        tokenProof = {
          rowExists: true,
          hasToken: !!(data as any).access_token,
          updatedAt: (data as any).updated_at ?? null,
        };
      }
    }
  } catch (e: any) {
    tokenProof = { ...tokenProof, error: e?.message || String(e) };
  }

  return NextResponse.json(
    {
      ok: true,
      shop: shopParam,
      meta,
      tokenProof,
    },
    { status: 200 }
  );
}
