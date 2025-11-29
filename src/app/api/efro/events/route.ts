// src/app/api/efro/events/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getEfroSupabaseServerClient } from "@/lib/efro/supabaseServer";

export type EfroEvent = {
  id: string;
  shopDomain: string | null;
  userText: string | null;
  intent: string | null;
  productCount: number | null;
  plan: string | null;
  hadError: boolean | null;
  errorMessage: string | null;
  createdAt: string; // ISO-String
};

export type EfroEventsResponse = {
  events: EfroEvent[];
  disabled?: boolean;
};

export const dynamic = "force-dynamic";

/**
 * GET /api/efro/events
 * Read-only Endpoint für EFRO-Events
 * 
 * Query-Parameter:
 * - shopDomain (optional): Filter nach shop_domain
 * - limit (optional, default 50, max 200): Anzahl der Events
 */
export async function GET(req: NextRequest) {
  const supabase = getEfroSupabaseServerClient();
  
  if (!supabase) {
    console.warn("[EFRO events] Supabase not configured – returning empty list");
    return NextResponse.json(
      { events: [], disabled: true },
      { status: 200 }
    );
  }

  try {
    const searchParams = req.nextUrl.searchParams;
    const shopDomainParam = searchParams.get("shopDomain");
    const limitParam = searchParams.get("limit");
    
    // Limit validieren (default 50, max 200)
    let limit = 50;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 200); // max 200
      }
    }

    // shopDomain: Nur filtern, wenn Parameter vorhanden und nicht leer
    const shopDomain = shopDomainParam && shopDomainParam.trim().length > 0 
      ? shopDomainParam.trim() 
      : null;

    console.log("[GET /api/efro/events] Query params", {
      shopDomainParam,
      shopDomain,
      limit,
      hasFilter: shopDomain !== null,
    });

    // Query bauen - IMMER aus efro_events
    let query = supabase
      .from("efro_events")
      .select("id, shop_domain, user_text, intent, product_count, plan, had_error, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Optional: Filter nach shopDomain - NUR wenn nicht null
    if (shopDomain !== null) {
      query = query.eq("shop_domain", shopDomain);
      console.log("[GET /api/efro/events] Applying shop_domain filter", { shopDomain });
    } else {
      console.log("[GET /api/efro/events] No shop_domain filter - fetching all events");
    }

    const { data, error } = await query;
    
    console.log("[EFRO Events API]", {
      eventCount: data?.length ?? 0,
      sample: data?.slice(0, 3),
    });

    console.log("[GET /api/efro/events] Supabase query result", {
      hasError: !!error,
      errorMessage: error?.message,
      dataCount: data?.length ?? 0,
      sampleData: data?.slice(0, 2),
    });

    if (error) {
      console.error("[GET /api/efro/events] Supabase error", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Daten transformieren (snake_case → camelCase)
    const events: EfroEvent[] = (data || []).map((row: any) => ({
      id: row.id,
      shopDomain: row.shop_domain || null,
      userText: row.user_text || null,
      intent: row.intent || null,
      productCount: row.product_count ?? null,
      plan: row.plan || null,
      hadError: row.had_error ?? false,
      errorMessage: row.error_message || null,
      createdAt: row.created_at || new Date().toISOString(),
    }));

    console.log("[GET /api/efro/events] Final response", {
      shopDomainFilter: shopDomain || "(none - all events)",
      limit,
      eventCount: events.length,
      sampleIds: events.slice(0, 3).map((e) => e.id),
      sampleShopDomains: events.slice(0, 3).map((e) => e.shopDomain),
    });

    const response: EfroEventsResponse = {
      events,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err: any) {
    console.error("[GET /api/efro/events] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error while fetching events" },
      { status: 500 }
    );
  }
}

