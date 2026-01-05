export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// src/app/api/shopify-products/route.ts
import { jsonUtf8 } from "@/lib/http/jsonUtf8";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function resolveShopDomain(reqUrl?: string): string | null {
  // 1) explicit query: ?shop=...
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

type TokenCandidate = {
  token: string;
  tokenSource: "shops" | "efro_shops" | "env";
  tokenUpdatedAt: string | null;
};

async function getTokenCandidates(shopDomain: string): Promise<{
  candidates: TokenCandidate[];
  lookupErrors: string[];
}> {
  const lookupErrors: string[] = [];
  const candidates: TokenCandidate[] = [];

  // 1) DB (admin) – shops table
  try {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const { data, error } = await admin
        .from("shops")
        .select("access_token, updated_at")
        .eq("shop", shopDomain)
        .maybeSingle();

      if (error) {
        lookupErrors.push(`shops lookup error: ${error.message}`);
      } else {
        const tok = ((data as any)?.access_token || "").trim();
        if (tok) {
          candidates.push({
            token: tok,
            tokenSource: "shops",
            tokenUpdatedAt: (data as any)?.updated_at ?? null,
          });
        }
      }
    } else {
      lookupErrors.push("admin supabase client unavailable (createAdminSupabaseClient returned null)");
    }
  } catch (e: any) {
    lookupErrors.push(`shops lookup threw: ${e?.message || String(e)}`);
  }

  // 2) DB (admin) – efro_shops access_token (some code writes it there)
  try {
    const admin = createAdminSupabaseClient();
    if (admin) {
      const { data, error } = await admin
        .from("efro_shops")
        .select("access_token, updated_at")
        .eq("shop_domain", shopDomain)
        .maybeSingle();

      if (error) {
        lookupErrors.push(`efro_shops lookup error: ${error.message}`);
      } else {
        const tok = ((data as any)?.access_token || "").trim();
        if (tok) {
          candidates.push({
            token: tok,
            tokenSource: "efro_shops",
            tokenUpdatedAt: (data as any)?.updated_at ?? null,
          });
        }
      }
    }
  } catch (e: any) {
    lookupErrors.push(`efro_shops lookup threw: ${e?.message || String(e)}`);
  }

  // 3) Fallback env (legacy)
  const envTok = (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "").trim();
  if (envTok) {
    candidates.push({ token: envTok, tokenSource: "env", tokenUpdatedAt: null });
  }

  // de-dup by token value, keep first occurrence (shops > efro_shops > env)
  const seen = new Set<string>();
  const uniq = candidates.filter((c) => {
    if (seen.has(c.token)) return false;
    seen.add(c.token);
    return true;
  });

  return { candidates: uniq, lookupErrors };
}

async function fetchProductsWithToken(shopDomain: string, token: string) {
  const url = `https://${shopDomain}/admin/api/2024-01/products.json?limit=50`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const bodyText = await res.text().catch(() => "");
  return { res, bodyText };
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

    const { candidates, lookupErrors } = await getTokenCandidates(shopDomain);

    if (!candidates.length) {
      console.error("[Shopify Products] No token candidates", { shopDomain, lookupErrors });
      return jsonUtf8(
        {
          error: "No admin token available",
          shopDomain,
          tokenSourcesTried: [],
          tokenUpdatedAt: null,
          tokenLookupErrors: lookupErrors,
        },
        { status: 500 }
      );
    }

    const tried: Array<{
      tokenSource: TokenCandidate["tokenSource"];
      tokenUpdatedAt: string | null;
      status: number;
      bodyPreview: string;
    }> = [];

    // Try tokens in order. If auth fails (401/403) -> try next token.
    for (const cand of candidates) {
      const { res, bodyText } = await fetchProductsWithToken(shopDomain, cand.token);

      if (res.ok) {
        let json: any = null;
        try {
          json = JSON.parse(bodyText);
        } catch {
          // rare, but handle it
          return jsonUtf8(
            {
              error: "Shopify returned non-JSON",
              shopDomain,
              tokenSource: cand.tokenSource,
              tokenUpdatedAt: cand.tokenUpdatedAt,
              status: res.status,
              body: bodyText.slice(0, 800),
            },
            { status: 500 }
          );
        }

        return jsonUtf8({
          source: "shopify-admin",
          shopDomain,
          tokenSource: cand.tokenSource,
          tokenUpdatedAt: cand.tokenUpdatedAt,
          ...json,
        });
      }

      tried.push({
        tokenSource: cand.tokenSource,
        tokenUpdatedAt: cand.tokenUpdatedAt,
        status: res.status,
        bodyPreview: (bodyText || "").slice(0, 600),
      });

      // Only rotate on auth-related failures
      if (res.status === 401 || res.status === 403) {
        console.error("[Shopify Products] Auth failed, trying next token", {
          shopDomain,
          tokenSource: cand.tokenSource,
          status: res.status,
        });
        continue;
      }

      // Non-auth failure: stop and return error (rate limit, 5xx, etc.)
      console.error("[Shopify Products] Non-OK response (non-auth)", {
        shopDomain,
        status: res.status,
        tokenSource: cand.tokenSource,
      });

      return jsonUtf8(
        {
          error: "Shopify products fetch failed",
          shopDomain,
          status: res.status,
          body: bodyText,
          tokenSource: cand.tokenSource,
          tokenUpdatedAt: cand.tokenUpdatedAt,
          tokenSourcesTried: tried.map((t) => t.tokenSource),
          tried,
          tokenLookupErrors: lookupErrors,
        },
        { status: 500 }
      );
    }

    // If we get here, all candidates failed with 401/403
    const last = tried[tried.length - 1] ?? null;
    return jsonUtf8(
      {
        error: "Shopify auth failed for all available tokens",
        shopDomain,
        status: last?.status ?? 401,
        body: last?.bodyPreview ?? null,
        tokenSourcesTried: tried.map((t) => t.tokenSource),
        tried,
        tokenLookupErrors: lookupErrors,
      },
      { status: 500 }
    );
  } catch (err) {
    console.error("[Shopify Products] Fetch threw", err);
    return jsonUtf8({ error: "failed" }, { status: 500 });
  }
}
