/* scripts/push-admin-token-to-db.ts
 *
 * Purpose:
 * - Read SHOPIFY_ADMIN_ACCESS_TOKEN from .env.local (or process.env)
 * - Upsert into Supabase:
 *    1) shops: { shop, access_token, updated_at }
 *    2) efro_shops: { shop_domain, access_token, updated_at, last_seen_at }
 *
 * Safety:
 * - Never prints the token, only tokenLen.
 *
 * Usage:
 *   pnpm -s tsx scripts/push-admin-token-to-db.ts --shop=avatarsalespro-dev.myshopify.com
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

function stripQuotes(v: string): string {
  const s = v.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseDotenvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    val = stripQuotes(val);
    out[key] = val;
  }
  return out;
}

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  const parsed = parseDotenvFile(p);
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

function arg(name: string): string | null {
  const pref = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pref));
  return hit ? hit.slice(pref.length).trim() : null;
}

function requireEnv(name: string): string {
  const v = (process.env[name] || "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function upsertShopsToken(supabase: any, shop: string, token: string) {
  const now = new Date().toISOString();

  // Prefer upsert (if unique constraint exists)
  const up1 = await supabase
    .from("shops")
    .upsert({ shop, access_token: token, updated_at: now }, { onConflict: "shop" })
    .select("shop, updated_at")
    .maybeSingle();

  if (!up1.error) return { ok: true, mode: "upsert", data: up1.data };

  // Fallback select->update/insert
  const sel = await supabase.from("shops").select("shop").eq("shop", shop).maybeSingle();
  if (sel.error) throw new Error(`shops select failed: ${sel.error.message}`);

  if (sel.data) {
    const upd = await supabase
      .from("shops")
      .update({ access_token: token, updated_at: now })
      .eq("shop", shop)
      .select("shop, updated_at")
      .maybeSingle();
    if (upd.error) throw new Error(`shops update failed: ${upd.error.message}`);
    return { ok: true, mode: "update", data: upd.data };
  }

  const ins = await supabase
    .from("shops")
    .insert([{ shop, access_token: token, updated_at: now }])
    .select("shop, updated_at")
    .maybeSingle();
  if (ins.error) throw new Error(`shops insert failed: ${ins.error.message}`);
  return { ok: true, mode: "insert", data: ins.data };
}

async function upsertEfroShopsToken(supabase: any, shop: string, token: string) {
  const now = new Date().toISOString();

  const up1 = await supabase
    .from("efro_shops")
    .upsert(
      { shop_domain: shop, access_token: token, updated_at: now, last_seen_at: now },
      { onConflict: "shop_domain" }
    )
    .select("shop_domain, updated_at, last_seen_at")
    .maybeSingle();

  if (!up1.error) return { ok: true, mode: "upsert", data: up1.data };

  // Fallback select->update/insert
  const sel = await supabase.from("efro_shops").select("shop_domain").eq("shop_domain", shop).maybeSingle();
  if (sel.error) throw new Error(`efro_shops select failed: ${sel.error.message}`);

  if (sel.data) {
    const upd = await supabase
      .from("efro_shops")
      .update({ access_token: token, updated_at: now, last_seen_at: now })
      .eq("shop_domain", shop)
      .select("shop_domain, updated_at, last_seen_at")
      .maybeSingle();
    if (upd.error) throw new Error(`efro_shops update failed: ${upd.error.message}`);
    return { ok: true, mode: "update", data: upd.data };
  }

  const ins = await supabase
    .from("efro_shops")
    .insert([{ shop_domain: shop, access_token: token, updated_at: now, last_seen_at: now }])
    .select("shop_domain, updated_at, last_seen_at")
    .maybeSingle();
  if (ins.error) throw new Error(`efro_shops insert failed: ${ins.error.message}`);
  return { ok: true, mode: "insert", data: ins.data };
}

async function main() {
  loadEnvLocal();

  const shop = (arg("shop") || process.env.SHOPIFY_STORE_DOMAIN || "").trim();
  if (!shop) throw new Error("Missing shop domain: pass --shop=... or set SHOPIFY_STORE_DOMAIN");

  const token = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  if (!token) throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN in env/.env.local");

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_KEY");

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  console.log("=== PUSH TOKEN TO DB (safe output) ===");
  console.log(JSON.stringify({ shop, tokenLen: token.length }, null, 2));

  const r1 = await upsertShopsToken(supabase, shop, token);
  console.log("=== shops result ===");
  console.log(JSON.stringify(r1, null, 2));

  const r2 = await upsertEfroShopsToken(supabase, shop, token);
  console.log("=== efro_shops result ===");
  console.log(JSON.stringify(r2, null, 2));

  console.log("DONE");
}

main().catch((e) => {
  console.error("FAILED:", e?.message || String(e));
  process.exit(1);
});
