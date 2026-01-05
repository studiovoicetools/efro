/* scripts/smoke-shopify-uninstall.ts
 *
 * Creates a fake efro_shops row (shop_domain = smoke-uninstall-*.myshopify.com),
 * calls /api/shopify-webhook with topic app/uninstalled, then verifies that the row
 * was invalidated (access_token cleared + onboarding_status set to uninstalled).
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-uninstall.ts --base=https://app.avatarsalespro.com
 */

import crypto from "node:crypto";
import process from "node:process";

function getArg(name: string): string | null {
  const p = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(p));
  return hit ? hit.slice(p.length) : null;
}

function must(name: string): string {
  const v = getArg(name);
  if (!v) throw new Error(`Missing --${name}=...`);
  return v;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return String(v).trim();
}

async function main() {
  const base = must("base").replace(/\/+$/, "");
  const secret = env("SHOPIFY_API_SECRET");
  const supabaseUrl = env("SUPABASE_URL");
  const supabaseKey = env("SUPABASE_SERVICE_KEY");

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const shop = `smoke-uninstall-${Date.now()}.myshopify.com`;

  console.log("=== SETUP: create fake efro_shops row ===");
  const now = new Date().toISOString();

  // Try insert with columns you have; tolerate missing ones.
  const insA = await sb.from("efro_shops").insert({
    shop_domain: shop,
    access_token: "shpat_smoke_token",
    scopes: "read_products",
    onboarding_status: "dev",
    last_seen_at: now,
    locale: "de",
    currency: "EUR",
    plan: "internal",
    installed_at: now,
  } as any);

  if (insA.error) {
    console.log(JSON.stringify({ ok: false, step: "insert efro_shops", error: insA.error.message }, null, 2));
    process.exit(1);
  }

  // Fetch id
  const sel0 = await sb.from("efro_shops").select("id, shop_domain, access_token, onboarding_status").eq("shop_domain", shop).maybeSingle();
  if (sel0.error || !sel0.data?.id) {
    console.log(JSON.stringify({ ok: false, step: "select efro_shops", error: sel0.error?.message || "no row" }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, created: sel0.data }, null, 2));

  console.log("=== CALL: webhook app/uninstalled ===");
  const payload = { id: Date.now() };
  const raw = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("base64");

  const res = await fetch(`${base}/api/shopify-webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": "app/uninstalled",
      "x-shopify-shop-domain": shop,
      "x-shopify-hmac-sha256": hmac,
    },
    body: raw,
  });

  const bodyText = await res.text();
  let json: any = null;
  try { json = JSON.parse(bodyText); } catch {}

  console.log(JSON.stringify({ status: res.status, bodyPreview: bodyText.slice(0, 600), json }, null, 2));

  console.log("=== VERIFY: row invalidated ===");
  const sel1 = await sb.from("efro_shops").select("id, shop_domain, access_token, scopes, onboarding_status, shopify_host").eq("shop_domain", shop).maybeSingle();
  if (sel1.error || !sel1.data) {
    console.log(JSON.stringify({ ok: false, step: "verify select", error: sel1.error?.message || "no row" }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, row: sel1.data }, null, 2));

  const tokenCleared = sel1.data.access_token === null;
  const statusOk = String(sel1.data.onboarding_status || "").toLowerCase().includes("uninstalled");

  if (!tokenCleared || !statusOk) {
    console.error("SMOKE-FAILED: uninstall did not clear token and/or status");
    process.exit(1);
  }

  console.log("SMOKE-OK ✅ uninstall invalidated efro_shops row (fake shop)");
}

main().catch((e) => {
  console.error("SMOKE-FAILED (exception)", e?.message || e);
  process.exit(1);
});
