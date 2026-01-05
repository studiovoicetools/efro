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
 * We intentionally use an untyped Supabase admin client (any),
 * to avoid TS "never" errors across envs and keep flexible upsert logic.
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

function omitKey<T extends Record<string, any>>(obj: T, key: string): T {
  const out: any = {};
  for (const k of Object.keys(obj)) {
    if (k !== key) out[k] = obj[k];
  }
  return out as T;
}

function makeId(): string {
  // Works for uuid columns (valid uuid string) and also for text/varchar PKs.
  // If your products.id is text without default => this fixes NOT NULL.
  if ((crypto as any).randomUUID) return (crypto as any).randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

async function updateOrInsertProducts(params: {
  supabase: any;
  existingId: string | null;
  payload: Record<string, any>;
  shopDomain: string;
  sku: string;
}) {
  const { supabase, existingId, payload, shopDomain, sku } = params;

  const withTs = (o: Record<string, any>) => ({ ...o, updated_at: new Date().toISOString() });
  const noTs = (o: Record<string, any>) => omitKey(o, "updated_at");

  const ensureIdOnInsert = (o: Record<string, any>) => {
    if (existingId) return o;
    const idVal = o.id ? String(o.id) : makeId();
    return { ...o, id: idVal };
  };

  // Attempt A: include updated_at
  if (existingId) {
    const upd = await supabase.from("products").update(withTs(payload)).eq("id", existingId);
    if (!upd.error) return { ok: true as const };
    if (isMissingColumnError(upd.error, "updated_at")) {
      const upd2 = await supabase.from("products").update(noTs(payload)).eq("id", existingId);
      return { ok: !upd2.error, error: upd2.error };
    }
    return { ok: false as const, error: upd.error };
  } else {
    const ins = await supabase.from("products").insert([ensureIdOnInsert(withTs(payload))]);
    if (!ins.error) return { ok: true as const };
    if (isMissingColumnError(ins.error, "updated_at")) {
      const ins2 = await supabase.from("products").insert([ensureIdOnInsert(noTs(payload))]);
      return { ok: !ins2.error, error: ins2.error };
    }
    return { ok: false as const, error: ins.error };
  }
}

/**
 * No-constraint upsert:
 * - products table has PK(id) only (no unique sku guaranteed)
 * - so we do: SELECT id (shop_uuid+sku) -> UPDATE by id, else INSERT
 * - if shop_uuid columns don't exist -> fallback to sku-only mode
 *
 * ALSO:
 * - if updated_at column doesn't exist -> retry without updated_at
 * - if id has no default and is NOT NULL -> we generate an id for inserts
 */
async function upsertProductNoConstraint(params: {
  supabase: any;
  shopUuid: string | null;
  shopDomain: string;
  sku: string;
  productDataCore: Record<string, any>;
}) {
  const { supabase, shopUuid, shopDomain, sku, productDataCore } = params;

  let mode: "shop_sku" | "sku_only" = shopUuid ? "shop_sku" : "sku_only";

  const productDataShop = {
    ...productDataCore,
    shop_uuid: shopUuid,
    shop_domain: shopDomain,
  };

  const productDataSkuOnly = {
    ...productDataCore,
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
    // try with updated_at ordering first; if missing, retry without order
    const base = supabase.from("products").select("id").eq("sku", sku);

    const selA = await base.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (selA.error) {
      if (isMissingColumnError(selA.error, "updated_at")) {
        const selB = await supabase.from("products").select("id").eq("sku", sku).limit(1).maybeSingle();
        if (selB.error) {
          console.error("[shopify-webhook] select(sku) failed (no updated_at fallback)", { error: selB.error.message, shopDomain, sku });
          existingId = null;
        } else if ((selB.data as any)?.id) {
          existingId = String((selB.data as any).id);
        }
      } else {
        console.error("[shopify-webhook] select(sku) failed", { error: selA.error.message, shopDomain, sku });
        existingId = null;
      }
    } else if ((selA.data as any)?.id) {
      existingId = String((selA.data as any).id);
    }
  }

  const payload = mode === "shop_sku" ? productDataShop : productDataSkuOnly;

  const r = await updateOrInsertProducts({
    supabase,
    existingId,
    payload,
    shopDomain,
    sku,
  });

  if (!r.ok) {
    // If shop columns missing AND we were in shop_sku, retry sku_only payload
    const msg = (r.error?.message || "").toString();
    const shopColsMissing =
      isMissingColumnError(r.error, "shop_uuid") ||
      isMissingColumnError(r.error, "shop_domain") ||
      msg.includes('column "shop_uuid"') ||
      msg.includes('column "shop_domain"');

    if (mode === "shop_sku" && shopColsMissing) {
      const r2 = await updateOrInsertProducts({
        supabase,
        existingId,
        payload: productDataSkuOnly,
        shopDomain,
        sku,
      });
      if (!r2.ok) throw new Error(`products ${existingId ? "update" : "insert"} failed (sku_only fallback): ${r2.error?.message || "unknown"}`);
      return { action: existingId ? "update" : "insert", mode: "sku_only" as const };
    }

    throw new Error(`products ${existingId ? "update" : "insert"} failed: ${r.error?.message || "unknown"}`);
  }

  return { action: existingId ? "update" : "insert", mode };
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
      .upsert({ shop_domain: shopDomain, last_seen_at: new Date().toISOString() }, { onConflict: "shop_domain" })
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
