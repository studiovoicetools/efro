export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// src/app/api/shopify-products/route.ts
import { jsonUtf8 } from "@/lib/http/jsonUtf8";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function resolveShopDomain(reqUrl?: string): string | null {
  // 1) explizit über Query: ?shop=...
  try {
    if (reqUrl) {
      const u = new URL(reqUrl);
      const shop = u.searchParams.get("shop");
      if (shop && shop.trim().length > 0) return shop.trim();
    }
  } catch {
    // ignore
  }

  // 2) fallback env (legacy)
  const env = (process.env.SHOPIFY_STORE_DOMAIN || "").trim();
  return env.length > 0 ? env : null;
}

type TokenLookup = {
  token: string | null;
  tokenSource: "shops" | "env" | "none";
  tokenUpdatedAt: string | null;
  tokenLookupError?: string;
};

async function getAdminTokenForShop(shopDomain: string): Promise<TokenLookup> {
  // 1) Prefer DB (read-after-write proof)
  try {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const { data, error } = await admin
        .from("shops")
        .select("access_token, updated_at")
        .eq("shop", shopDomain)
        .maybeSingle();

      if (error) {
        return {
          token: null,
          tokenSource: "none",
          tokenUpdatedAt: null,
          tokenLookupError: `shops lookup error: ${error.message}`,
        };
      }

      const tok = ((data as any)?.access_token || "").trim();
      if (tok) {
        return {
          token: tok,
          tokenSource: "shops",
          tokenUpdatedAt: (data as any)?.updated_at ?? null,
        };
      }
    }
  } catch (e: any) {
    return {
      token: null,
      tokenSource: "none",
      tokenUpdatedAt: null,
      tokenLookupError: e?.message || String(e),
    };
  }

  // 2) Fallback env (legacy)
  const envTok = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  if (envTok) {
    return { token: envTok, tokenSource: "env", tokenUpdatedAt: null };
  }

  return { token: null, tokenSource: "none", tokenUpdatedAt: null };
}

export async function GET(request: Request) {
  try {
    const shopDomain = resolveShopDomain(request.url);

    if (!shopDomain) {
      return jsonUtf8(
        { error: "Missing shop domain (?shop=... or SHOPIFY_STORE_DOMAIN)" },
        { status: 400 }
      );
    }

    const tok = await getAdminTokenForShop(shopDomain);

    if (!tok.token) {
      console.error("[Shopify Products] Missing token", {
        shopDomain,
        tokenSource: tok.tokenSource,
        tokenLookupError: tok.tokenLookupError,
      });

      return jsonUtf8(
        {
          error: "No admin token available",
          shopDomain,
          tokenSource: tok.tokenSource,
          tokenUpdatedAt: tok.tokenUpdatedAt,
          tokenLookupError: tok.tokenLookupError,
        },
        { status: 500 }
      );
    }

    const url = `https://${shopDomain}/admin/api/2024-01/products.json?limit=50`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": tok.token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[Shopify Products] Non-OK response", {
        shopDomain,
        status: res.status,
        bodyText,
        tokenSource: tok.tokenSource,
      });

      return jsonUtf8(
        {
          error: "Shopify products fetch failed",
          shopDomain,
          status: res.status,
          body: bodyText,
          tokenSource: tok.tokenSource,
          tokenUpdatedAt: tok.tokenUpdatedAt,
        },
        { status: 500 }
      );
    }

    const data = await res.json();

    return jsonUtf8({
      source: "shopify-admin",
      shopDomain,
      tokenSource: tok.tokenSource,
      tokenUpdatedAt: tok.tokenUpdatedAt,
      ...data,
    });
  } catch (err) {
    console.error("[Shopify Products] Fetch threw", err);
    return jsonUtf8({ error: "failed" }, { status: 500 });
  }
}
