/* scripts/smoke-shopify-webhook.ts
 *
 * Sends a Shopify-style webhook POST to /api/shopify-webhook with a correct HMAC signature,
 * then verifies the SKU exists in Supabase (products table).
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-webhook.ts \
 *     --base=https://app.avatarsalespro.com \
 *     --shop=avatarsalespro-dev.myshopify.com
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, any>;

function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  return s;
}

function loadEnvLocal(): void {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = stripQuotes(line.slice(i + 1));
    if (!process.env[k]) process.env[k] = v;
  }
}

function getArg(name: string): string | null {
  const key = `--${name}=`;
  const a = process.argv.find((x) => x.startsWith(key));
  return a ? a.slice(key.length) : null;
}

function mustEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function pickWebhookSecret(): { name: string; value: string } {
  const candidates = ["SHOPIFY_WEBHOOK_SECRET", "SHOPIFY_API_SECRET", "SHOPIFY_CLIENT_SECRET"];
  for (const n of candidates) {
    const v = (process.env[n] || "").trim();
    if (v) return { name: n, value: v };
  }
  throw new Error("Missing webhook secret env (need SHOPIFY_WEBHOOK_SECRET or SHOPIFY_API_SECRET or SHOPIFY_CLIENT_SECRET)");
}

function normalizeBase(u: string): string {
  let s = u.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(s)) s = "http://" + s;
  return s;
}

async function httpPostJson(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { method: "POST", headers, body });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  loadEnvLocal();

  const base = normalizeBase(getArg("base") || process.env.NEXT_PUBLIC_APP_URL || "https://app.avatarsalespro.com");
  const shop = (getArg("shop") || process.env.SHOPIFY_STORE_DOMAIN || "").trim().toLowerCase();
  if (!shop) throw new Error("Missing shop: pass --shop=... or set SHOPIFY_STORE_DOMAIN");

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseKey =
    (process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      "").trim();
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase env (need SUPABASE_URL + SUPABASE_SERVICE_KEY)");

  const secret = pickWebhookSecret();

  const now = new Date();
  const sku = `SMOKE-${now.toISOString().replace(/[:.]/g, "").replace("T", "-").replace("Z", "")}`;

  const payload: Json = {
    id: Math.floor(Math.random() * 1e12),
    title: `Smoke Product ${sku}`,
    body_html: `<p>Smoke test ${sku}</p>`,
    product_type: "Smoke",
    tags: "smoke,webhook",
    images: [{ src: "" }],
    variants: [
      {
        sku,
        price: "12.34",
        compare_at_price: null,
      },
    ],
  };

  const rawBody = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret.value).update(rawBody, "utf8").digest("base64");

  console.log("=== SMOKE: WEBHOOK REQUEST (safe) ===");
  console.log(
    JSON.stringify(
      {
        base,
        shop,
        topic: "products/create",
        sku,
        secretEnv: secret.name,
        secretLen: secret.value.length,
        hmacLen: hmac.length,
      },
      null,
      2
    )
  );

  const url = `${base}/api/shopify-webhook`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-shopify-topic": "products/create",
    "x-shopify-shop-domain": shop,
    "x-shopify-hmac-sha256": hmac,
  };

  const resp = await httpPostJson(url, headers, rawBody);

  console.log("=== WEBHOOK RESPONSE ===");
  let jsonResp: any = null;
  try {
    jsonResp = JSON.parse(resp.text);
  } catch {
    jsonResp = null;
  }
  console.log(
    JSON.stringify(
      {
        status: resp.status,
        bodyPreview: resp.text.slice(0, 600),
        json: jsonResp,
      },
      null,
      2
    )
  );

  // webhook route returns 200 even on internal errors (by design) – so we verify via Supabase
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log("=== SUPABASE VERIFY (products by sku) ===");
  const q1 = await supabase
    .from("products")
    .select("id, sku, title, shop_domain, shop_uuid")
    .eq("sku", sku)
    .limit(3);

  if (q1.error) {
    console.log(JSON.stringify({ ok: false, error: q1.error.message }, null, 2));
    process.exit(1);
  }

  const rows = (q1.data as any[]) || [];
  console.log(JSON.stringify({ ok: true, found: rows.length, rows }, null, 2));

  if (!rows.length) {
    console.log("SMOKE-FAILED: webhook did not create/update a product row (sku not found)");
    process.exit(1);
  }

  console.log("SMOKE-OK ✅ webhook -> Supabase products row exists");
}

main().catch((e) => {
  console.error("SMOKE-FAILED:", e?.message || String(e));
  process.exit(1);
});
