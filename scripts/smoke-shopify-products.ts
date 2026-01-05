/* scripts/smoke-shopify-products.ts
 *
 * Verifies:
 * - Supabase rows:
 *   - shops (admin token for shopDomain)
 *   - efro_shops (shop meta row)
 * - HTTP route /api/shopify-products is reachable
 *
 * Debug goal:
 * - When /api/shopify-products returns non-OK, PRINT:
 *   - apiError
 *   - shopifyStatus (the upstream Shopify status forwarded by API)
 *   - shopifyBodyPreview (first 600 chars of forwarded raw body)
 *
 * Robustness:
 * - Loads .env.local itself (no dependency).
 * - 404 is NOT treated as "reached".
 * - ngrok offline (ERR_NGROK_3200) is NOT treated as "reached".
 * - Allows overrides: --shop=... --base=...
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

type Json = Record<string, any>;

function stripQuotes(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseDotenvLine(line: string): [string, string] | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const eq = t.indexOf("=");
  if (eq <= 0) return null;
  const key = t.slice(0, eq).trim();
  let val = t.slice(eq + 1).trim();
  val = stripQuotes(val);
  return [key, val];
}

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const kv = parseDotenvLine(line);
    if (!kv) continue;
    const [k, v] = kv;
    if (!process.env[k]) process.env[k] = v;
  }
}

function env(name: string): string | null {
  const v = process.env[name];
  if (!v) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function pickShopFromArgv(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--shop="));
  if (!arg) return null;
  const v = arg.slice("--shop=".length).trim();
  return v.length ? v : null;
}

function pickBaseFromArgv(): string | null {
  const arg = process.argv.find((a) => a.startsWith("--base="));
  if (!arg) return null;
  const v = arg.slice("--base=".length).trim().replace(/\/+$/, "");
  return v.length ? v : null;
}

function normalizeBase(u: string): string | null {
  const t = (u || "").trim().replace(/\/+$/, "");
  if (!t) return null;
  try {
    // validate URL
    // eslint-disable-next-line no-new
    new URL(t);
    return t;
  } catch {
    return null;
  }
}

function envVisibility() {
  const namesOnly = {
    node: process.version,
    cwd: process.cwd(),
    has_SHOPIFY_STORE_DOMAIN: !!env("SHOPIFY_STORE_DOMAIN"),
    has_SUPABASE_URL: !!(env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL")),
    has_SUPABASE_SERVICE_KEY: !!env("SUPABASE_SERVICE_KEY"),
    NEXT_PUBLIC_APP_URL: env("NEXT_PUBLIC_APP_URL") ? "[set]" : "[missing]",
    NEXTAUTH_URL: env("NEXTAUTH_URL") ? "[set]" : "[missing]",
    NEXT_PUBLIC_BASE_URL: env("NEXT_PUBLIC_BASE_URL") ? "[set]" : "[missing]",
  };
  console.log("=== ENV VISIBILITY (names only) ===");
  console.log(JSON.stringify(namesOnly, null, 2));
}

function getSupabaseAdminOrThrow() {
  const url = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getShopDomain(): Promise<string> {
  const fromArg = pickShopFromArgv();
  if (fromArg) return fromArg;

  const fromEnv = env("SHOPIFY_STORE_DOMAIN");
  if (fromEnv) return fromEnv;

  throw new Error("Missing shop domain: pass --shop=... or set SHOPIFY_STORE_DOMAIN");
}

async function checkSupabaseRows(shop: string) {
  const supabase = getSupabaseAdminOrThrow();

  console.log("=== SUPABASE: shops token row ===");
  const tok = await supabase.from("shops").select("access_token, updated_at").eq("shop", shop).maybeSingle();
  if (tok.error) {
    console.log(JSON.stringify({ ok: false, error: tok.error.message }, null, 2));
  } else {
    const token = ((tok.data as any)?.access_token || "").trim();
    console.log(
      JSON.stringify(
        {
          ok: true,
          shop,
          tokenPresent: !!token,
          tokenLen: token ? token.length : 0,
          updated_at: (tok.data as any)?.updated_at ?? null,
        },
        null,
        2
      )
    );
  }

  console.log("=== SUPABASE: efro_shops row ===");
  const meta = await supabase.from("efro_shops").select("*").eq("shop_domain", shop).maybeSingle();
  if (meta.error) {
    console.log(JSON.stringify({ ok: false, error: meta.error.message }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, row: meta.data ?? null }, null, 2));
  }
}

function buildBaseCandidates(): string[] {
  const forced = pickBaseFromArgv();
  if (forced) return [forced];

  const cands: string[] = [];

  // prefer public urls
  const a = normalizeBase(env("NEXT_PUBLIC_APP_URL") ?? "");
  const b = normalizeBase(env("NEXTAUTH_URL") ?? "");
  const c = normalizeBase(env("NEXT_PUBLIC_BASE_URL") ?? "");

  if (a) cands.push(a);
  if (b && b !== a) cands.push(b);
  if (c && c !== a && c !== b) cands.push(c);

  // then local dev
  cands.push("http://localhost:3000");

  // unique
  return [...new Set(cands)];
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function detectReachableBase(shop: string): Promise<{ base: string; resp: Response; bodyText: string }> {
  const bases = buildBaseCandidates();

  console.log("=== HTTP: /api/shopify-products (base detect) ===");

  const errors: string[] = [];
  for (const base of bases) {
    const url = `${base.replace(/\/+$/, "")}/api/shopify-products?shop=${encodeURIComponent(shop)}`;
    try {
      // 12s should be plenty even on prod
      const resp = await fetchWithTimeout(url, 12_000);
      const text = await resp.text().catch(() => "");

      // Treat 404 as NOT reached (ngrok offline returns 404 too)
      if (resp.status === 404) {
        console.log(`TRY base=${base} ... FAILED (status=404)`);
        errors.push(`${base}: 404`);
        continue;
      }

      // ngrok offline body marker
      if ((text || "").includes("ERR_NGROK_3200")) {
        console.log(`TRY base=${base} ... FAILED (ngrok offline)`);
        errors.push(`${base}: ERR_NGROK_3200`);
        continue;
      }

      console.log(`TRY base=${base} ... REACHED (status=${resp.status})`);
      return { base, resp, bodyText: text };
    } catch (e: any) {
      console.log(`TRY base=${base} ... FAILED`);
      errors.push(`${base}: ${e?.message || String(e)}`);
    }
  }

  console.log("Tried bases:", bases);
  console.log("Errors:", errors);
  throw new Error("Could not reach any base for /api/shopify-products");
}

function safeJsonParse(s: string): Json | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

async function main() {
  loadEnvLocal();
  envVisibility();

  const shop = await getShopDomain();
  console.log("=== SHOP DOMAIN ===");
  console.log(shop);

  await checkSupabaseRows(shop);

  const reached = await detectReachableBase(shop);

  const probeJson = safeJsonParse(reached.bodyText);
  const out: Json = {
    reachedBase: reached.base,
    url: `${reached.base.replace(/\/+$/, "")}/api/shopify-products?shop=${encodeURIComponent(shop)}`,
    ok: reached.resp.ok,
    status: reached.resp.status,
  };

  if (probeJson) {
    out.tokenSource = probeJson.tokenSource ?? null;
    out.tokenUpdatedAt = probeJson.tokenUpdatedAt ?? null;

    // The API forwards upstream Shopify status/body in these fields on error:
    out.apiError = probeJson.error ?? null;
    out.shopifyStatus = probeJson.status ?? null;

    const rawBody = typeof probeJson.body === "string" ? probeJson.body : "";
    out.shopifyBodyPreview = rawBody ? rawBody.slice(0, 600) : null;

    out.productsCount =
      Array.isArray(probeJson.products) ? probeJson.products.length :
      Array.isArray(probeJson.items) ? probeJson.items.length :
      probeJson.productsCount ?? null;

    out.keys = Object.keys(probeJson);
  } else {
    out.bodyPreview = (reached.bodyText || "").slice(0, 600);
  }

  console.log(JSON.stringify(out, null, 2));

  if (!reached.resp.ok) {
    throw new Error("SMOKE-FAILED: /api/shopify-products returned non-OK");
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  process.exit(1);
});
