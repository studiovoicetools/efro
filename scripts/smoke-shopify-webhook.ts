/* scripts/smoke-shopify-webhook.ts
 *
 * Sends a Shopify-style webhook POST to /api/shopify-webhook with correct HMAC signature,
 * then verifies the SKU exists in Supabase (products table).
 *
 * Usage:
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-webhook.ts \
 *     --base=https://app.avatarsalespro.com \
 *     --shop=avatarsalespro-dev.myshopify.com \
 *     --topic=products/create
 */

import crypto from "node:crypto";
import process from "node:process";

type Args = {
  base: string;
  shop: string;
  topic: string;
  title?: string;
};

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
  const args: Args = {
    base: must("base").replace(/\/+$/, ""),
    shop: must("shop").trim(),
    topic: (getArg("topic") || "products/create").trim(),
    title: getArg("title") || undefined,
  };

  const secret = env("SHOPIFY_API_SECRET");
  const supabaseUrl = env("SUPABASE_URL");
  const supabaseKey = env("SUPABASE_SERVICE_KEY");

  const sku = `SMOKE-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
  const title = args.title || `Smoke Product ${sku}`;

  const payload = {
    id: Date.now(),
    title,
    variants: [{ sku }],
  };

  const raw = JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret).update(raw, "utf8").digest("base64");

  console.log("=== SMOKE: WEBHOOK REQUEST (safe) ===");
  console.log(
    JSON.stringify(
      {
        base: args.base,
        shop: args.shop,
        topic: args.topic,
        sku,
        secretEnv: "SHOPIFY_API_SECRET",
        secretLen: secret.length,
        hmacLen: hmac.length,
      },
      null,
      2
    )
  );

  const res = await fetch(`${args.base}/api/shopify-webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-topic": args.topic,
      "x-shopify-shop-domain": args.shop,
      "x-shopify-hmac-sha256": hmac,
    },
    body: raw,
  });

  const bodyText = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(bodyText);
  } catch {}

  console.log("=== WEBHOOK RESPONSE ===");
  console.log(
    JSON.stringify(
      {
        status: res.status,
        bodyPreview: bodyText.slice(0, 600),
        json,
      },
      null,
      2
    )
  );

  // Verify in Supabase
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log("=== SUPABASE VERIFY (products by sku) ===");
  const sel = await sb.from("products").select("id, sku, title, shop_domain, shop_uuid").eq("sku", sku).limit(5);

  if (sel.error) {
    console.log(JSON.stringify({ ok: false, error: sel.error.message }, null, 2));
    process.exit(1);
  }
  const rows = sel.data || [];
  console.log(JSON.stringify({ ok: true, found: rows.length, rows }, null, 2));

  if (rows.length < 1) {
    console.error("SMOKE-FAILED: webhook did not create/update a product row (sku not found)");
    process.exit(1);
  }

  console.log("SMOKE-OK ✅ webhook -> Supabase products row exists");
}

main().catch((e) => {
  console.error("SMOKE-FAILED (exception)", e?.message || e);
  process.exit(1);
});
