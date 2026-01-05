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
  const t = String(v).trim();
  return t.length ? t : null;
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

function safeEq(a: string, b: string): boolean {
  const aa = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function isMissingColumnError(err: any, columnName: string): boolean {
  const msg = (err?.message || "").toString().toLowerCase();
  const col = columnName.toLowerCase();

  // Classic Postgres error variants:
  if (msg.includes(`column "${col}" does not exist`) || msg.includes(`column ${col} does not exist`)) return true;

  // Supabase/PostgREST schema-cache variant:
  // e.g. "Could not find the 'updated_at' column of 'products' in the schema cache"
  if (msg.includes("schema cache") && msg.includes("'" + col + "'")) return true;
  if (msg.includes("schema cache") && msg.includes(col)) return true;

  return false;
}

function genUuid(): string {
  const c: any = crypto as any;
  if (c.randomUUID) return c.randomUUID();
  return crypto.randomBytes(16).toString("hex");
}

function pickSku(payload: any): string | null {
  // Shopify product payload usually has variants[]
  const v = payload?.variants;
  if (Array.isArray(v)) {
    for (const it of v) {
      const s = (it?.sku ?? "").toString().trim();
      if (s) return s;
    }
  }
  // fallback: allow top-level sku (for custom smokes)
  const s2 = (payload?.sku ?? "").toString().trim();
  return s2 || null;
}

function pickTitle(payload: any, sku: string): string {
  const t = (payload?.title ?? "").toString().trim();
  return t || `Smoke Product ${sku}`;
}

function verifyShopifyHmac(rawBody: Buffer, secret: string, hmacHeader: string | null): boolean {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  return safeEq(digest, hmacHeader);
}

export async function POST(req: NextRequest) {
  const topic = String(req.headers.get("x-shopify-topic") || "").toLowerCase();
  const shopDomain = String(req.headers.get("x-shopify-shop-domain") || "").toLowerCase();
  const hmac = req.headers.get("x-shopify-hmac-sha256");

  if (!topic) return json(400, { ok: false, error: "missing x-shopify-topic header" });
  if (!shopDomain) return json(400, { ok: false, error: "missing x-shopify-shop-domain header", topic });

  const secret = env("SHOPIFY_API_SECRET");
  if (!secret) return json(500, { ok: false, error: "missing env SHOPIFY_API_SECRET", topic, shopDomain });

  // Raw body for HMAC verification
  const raw = Buffer.from(await req.arrayBuffer());
  if (!verifyShopifyHmac(raw, secret, hmac)) {
    return json(401, { ok: false, error: "invalid webhook signature", topic, shopDomain });
  }

  let payload: any = null;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return json(400, { ok: false, error: "invalid JSON body", topic, shopDomain });
  }

  const supabaseUrl = env("SUPABASE_URL") || env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return json(500, { ok: false, error: "missing SUPABASE_URL/SUPABASE_SERVICE_KEY", topic, shopDomain });
  }

  const admin = createSupabaseAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-efro": "shopify-webhook" } },
  });

  // Resolve shop_uuid (efro_shops.id) by shop_domain
  const shopRow = await admin
    .from("efro_shops")
    .select("id, shop_domain")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  const shopUuid = (shopRow.data?.id as string | undefined) ?? null;
  if (!shopUuid) {
    return json(404, { ok: false, error: "shop not found in efro_shops (by shop_domain)", topic, shopDomain });
  }

  // --- app/uninstalled (no sku) ---
  if (topic === "app/uninstalled" || topic === "app/uninstall") {
    const now = new Date().toISOString();

    // Try set access_token null; if NOT NULL constraint exists, fallback to ""
    let upd = await admin
      .from("efro_shops")
      .update({ access_token: null, onboarding_status: "uninstalled", last_seen_at: now } as any)
      .eq("id", shopUuid);

    if (upd.error && String(upd.error.message || "").toLowerCase().includes("not-null")) {
      upd = await admin
        .from("efro_shops")
        .update({ access_token: "", onboarding_status: "uninstalled", last_seen_at: now } as any)
        .eq("id", shopUuid);
    }

    if (upd.error) {
      // still return 200 so Shopify does not retry forever; but mark ok:false
      return json(200, { ok: false, error: `uninstall update failed: ${upd.error.message}`, topic, shopDomain });
    }

    return json(200, { ok: true, topic, shopDomain, action: "uninstalled" });
  }

  // --- products/create or products/update ---
  if (topic === "products/create" || topic === "products/update") {
    const sku = pickSku(payload);
    if (!sku) return json(400, { ok: false, error: "missing sku in payload (variants[*].sku)", topic, shopDomain });

    const title = pickTitle(payload, sku);
    const now = new Date().toISOString();

    // Find existing product by (shop_uuid, sku)
    const base = admin.from("products").select("id").eq("shop_uuid", shopUuid as any).eq("sku", sku);

    const selA = await base.limit(1).maybeSingle();
    let existingId: string | null = null;

    if (selA.error && isMissingColumnError(selA.error, "updated_at")) {
      const selB = await base.limit(1).maybeSingle();
      if (selB.error) return json(500, { ok: false, error: `products select failed: ${selB.error.message}`, topic });
      existingId = (selB.data?.id as any) ?? null;
    } else if (selA.error) {
      return json(500, { ok: false, error: `products select failed: ${selA.error.message}`, topic });
    } else {
      existingId = (selA.data?.id as any) ?? null;
    }

    const rowBase: Record<string, any> = {
      id: existingId || genUuid(), // IMPORTANT: always set id on inserts
      shop_uuid: shopUuid,
      shop_domain: shopDomain,
      sku,
      title,
    };

    // Update or Insert with updated_at fallback if missing
    if (existingId) {
      // UPDATE
      let upd = await admin.from("products").update(rowBase).eq("id", existingId);
      if (upd.error && isMissingColumnError(upd.error, "updated_at")) {
        const { updated_at, ...noUpdAt } = rowBase;
        upd = await admin.from("products").update(noUpdAt).eq("id", existingId);
      }
      if (upd.error) return json(500, { ok: false, error: `products update failed: ${upd.error.message}`, topic });

      return json(200, { ok: true, shopDomain, sku, topic, action: "update", mode: "shop_sku" });
    } else {
      // INSERT
      let ins = await admin.from("products").insert(rowBase);
      if (ins.error && isMissingColumnError(ins.error, "updated_at")) {
        const { updated_at, ...noUpdAt } = rowBase;
        ins = await admin.from("products").insert(noUpdAt);
      }
      if (ins.error) return json(500, { ok: false, error: `products insert failed: ${ins.error.message}`, topic });

      return json(200, { ok: true, shopDomain, sku, topic, action: "insert", mode: "shop_sku" });
    }
  }

  // --- other topics: acknowledge but do nothing (avoid retries) ---
  return json(200, { ok: true, skipped: true, reason: "topic not handled", topic, shopDomain });
}
