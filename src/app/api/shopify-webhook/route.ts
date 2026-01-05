// src/app/api/shopify-webhook/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

function env(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const t = v.trim();
  return t.length ? t : null;
}

/**
 * IMPORTANT:
 * In this route we intentionally use an untyped Supabase admin client (any),
 * because schema/types may differ between environments and we want flexible
 * upsert logic (products PK is id; sku is not guaranteed to be unique).
 *
 * This avoids TS "never" errors like:
 *   Argument of type '{ ... }' is not assignable to parameter of type 'never'.
 */
function getSupabaseAdmin(): any {
  const url = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey =
    env("SUPABASE_SERVICE_KEY") ??
    env("SUPABASE_SERVICE_ROLE_KEY") ??
    env("SUPABASE_ANON_KEY") ??
    env("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase env (need SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY)");
  }

  return createSupabaseAdminClient(url, serviceKey, {
    auth: { persistSession: false },
  }) as any;
}

function getWebhookSecret(): string {
  return (
    env("SHOPIFY_WEBHOOK_SECRET") ??
    env("SHOPIFY_API_SECRET") ??
    env("SHOPIFY_CLIENT_SECRET") ??
    ""
  );
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const aa = Buffer.from((a || "").trim(), "utf8");
  const bb = Buffer.from((b || "").trim(), "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function verifyShopifyHmacBase64(rawBody: string, hmacHeader: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  return timingSafeEqualStr(digest, hmacHeader);
}

function normalizeShopDomain(s: string): string {
  return (s || "").trim().toLowerCase();
}

function parsePrice(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const p = parseFloat(v.replace(",", "."));
    return Number.isFinite(p) ? p : 0;
  }
  return 0;
}

function isMissingColumnError(err: any, columnName: string): boolean {
  const msg = (err?.message || "").toString().toLowerCase();
  const col = columnName.toLowerCase();
  return msg.includes(`column "${col}" does not exist`) || msg.includes(`column ${col} does not exist`);
}

/**
 * No-constraint upsert:
 * - products table has PK(id) only (no unique sku guaranteed)
 * - so we do: SELECT id (shop_uuid+sku) -> UPDATE by id, else INSERT
 * - if shop_uuid columns don't exist -> fallback to sku-only mode
 */
async function upsertProductNoConstraint(params: {
  supabase: any;
  shopUuid: string | null;
  shopDomain: string;
  sku: string;
  productDataCore: Record<string, any>;
}) {
  const { supabase, shopUuid, shopDomain, sku, productDataCore } = params;

  let mode: "shop_sku" | "sku_only" = "shop_sku";
  if (!shopUuid) mode = "sku_only";

  const productDataShop = {
    ...productDataCore,
    shop_uuid: shopUuid,
    shop_domain: shopDomain,
    updated_at: new Date().toISOString(),
  };

  const productDataSkuOnly = {
    ...productDataCore,
    updated_at: new Date().toISOString(),
  };

  let existingId: string | null = null;

  if (mode === "shop_sku") {
    const sel = await supabase
      .from("products")
      .select("id")
      .eq("shop_uuid", shopUuid as any)
      .eq("sku", sku)
      .limit(1)
      .maybeSingle();

    if (sel.error) {
      if (isMissingColumnError(sel.error, "shop_uuid")) {
        mode = "sku_only";
      } else {
        console.error("[shopify-webhook] select(shop_uuid,sku) failed -> fallback sku_only", {
          error: sel.error.message,
          shopDomain,
          sku,
        });
        mode = "sku_only";
      }
    } else if ((sel.data as any)?.id) {
      existingId = String((sel.data as any).id);
    }
  }

  if (mode === "sku_only") {
    const sel = await supabase
      .from("products")
      .select("id")
      .eq("sku", sku)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sel.error) {
      console.error("[shopify-webhook] select(sku) failed", { error: sel.error.message, shopDomain, sku });
      existingId = null;
    } else if ((sel.data as any)?.id) {
      existingId = String((sel.data as any).id);
    }
  }

  const payload = mode === "shop_sku" ? productDataShop : productDataSkuOnly;

  if (existingId) {
    const upd = await supabase
      .from("products")
      .update(payload)
      .eq("id", existingId);

    if (upd.error) {
      if (mode === "shop_sku" && (isMissingColumnError(upd.error, "shop_uuid") || isMissingColumnError(upd.error, "shop_domain"))) {
        const upd2 = await supabase.from("products").update(productDataSkuOnly).eq("id", existingId);
        if (upd2.error) throw new Error(`products update failed (fallback): ${upd2.error.message}`);
        return { action: "update", mode: "sku_only" as const };
      }
      throw new Error(`products update failed: ${upd.error.message}`);
    }

    return { action: "update", mode };
  }

  const ins = await supabase.from("products").insert([payload]);
  if (ins.error) {
    if (mode === "shop_sku" && (isMissingColumnError(ins.error, "shop_uuid") || isMissingColumnError(ins.error, "shop_domain"))) {
      const ins2 = await supabase.from("products").insert([productDataSkuOnly]);
      if (ins2.error) throw new Error(`products insert failed (fallback): ${ins2.error.message}`);
      return { action: "insert", mode: "sku_only" as const };
    }
    throw new Error(`products insert failed: ${ins.error.message}`);
  }

  return { action: "insert", mode };
}

export async function POST(request: NextRequest) {
  const topic = request.headers.get("x-shopify-topic") || "unknown";
  const shopDomainHeader = request.headers.get("x-shopify-shop-domain") || "";
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";

  try {
    const secret = getWebhookSecret();
    if (!secret) {
      console.error("[shopify-webhook] Missing webhook secret env (SHOPIFY_WEBHOOK_SECRET/SHOPIFY_API_SECRET)");
      return NextResponse.json({ ok: false, error: "missing webhook secret" }, { status: 200 });
    }

    const rawBody = await request.text();

    if (!hmacHeader) {
      console.error("[shopify-webhook] Missing x-shopify-hmac-sha256 header", { topic });
      return NextResponse.json({ ok: false, error: "missing hmac header" }, { status: 200 });
    }

    const hmacOk = verifyShopifyHmacBase64(rawBody, hmacHeader, secret);
    if (!hmacOk) {
      console.error("[shopify-webhook] HMAC invalid", { topic, shopDomainHeader });
      return NextResponse.json({ ok: false, error: "hmac invalid" }, { status: 200 });
    }

    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      console.error("[shopify-webhook] Body is not JSON", { topic, shopDomainHeader });
      return NextResponse.json({ ok: false, error: "invalid json" }, { status: 200 });
    }

    const shopDomain = normalizeShopDomain(shopDomainHeader);
    if (!shopDomain) {
      console.error("[shopify-webhook] Missing x-shopify-shop-domain header", { topic });
      return NextResponse.json({ ok: false, error: "missing shop domain header" }, { status: 200 });
    }

    const supabase = getSupabaseAdmin();

    const { data: shopRow, error: shopErr } = await supabase
      .from("efro_shops")
      .upsert(
        { shop_domain: shopDomain, last_seen_at: new Date().toISOString() },
        { onConflict: "shop_domain" }
      )
      .select("id, shop_domain")
      .maybeSingle();

    if (shopErr) {
      console.error("[shopify-webhook] efro_shops upsert failed", { shopDomain, error: shopErr.message });
      return NextResponse.json({ ok: false, error: "efro_shops upsert failed" }, { status: 200 });
    }

    const shopUuid = (shopRow as any)?.id ? String((shopRow as any).id) : null;

    const variant = Array.isArray(body?.variants) ? body.variants[0] : undefined;
    const sku = (variant?.sku || body?.sku || "").toString().trim();

    if (!sku) {
      console.warn("[shopify-webhook] No SKU in payload -> skipped", { topic, shopDomain });
      return NextResponse.json({ ok: true, skipped: true, reason: "no sku", topic, shopDomain }, { status: 200 });
    }

    const productDataCore: Record<string, any> = {
      sku,
      title: (body?.title || "").toString(),
      description: (body?.body_html || "").toString(),
      price: parsePrice(variant?.price),
      compare_at_price: variant?.compare_at_price != null ? parsePrice(variant?.compare_at_price) : null,
      image_url: Array.isArray(body?.images) && body.images[0]?.src ? String(body.images[0].src) : "",
      category: (body?.product_type || "").toString(),
      tags: (body?.tags || "").toString(),
    };

    const result = await upsertProductNoConstraint({
      supabase,
      shopUuid,
      shopDomain,
      sku,
      productDataCore,
    });

    console.log("[shopify-webhook] synced", { shopDomain, sku, topic, ...result });
    return NextResponse.json({ ok: true, shopDomain, sku, topic, ...result }, { status: 200 });
  } catch (err: any) {
    console.error("[shopify-webhook] error", err);
    return NextResponse.json({ ok: false, error: err?.message || String(err), topic }, { status: 200 });
  }
}
