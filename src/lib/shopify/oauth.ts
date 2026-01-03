// src/lib/shopify/oauth.ts
// Minimaler OAuth Token Exchange (code -> access_token)

export type ShopifyTokenResult = {
  accessToken: string;
  scope?: string;
};

export async function exchangeShopifyAccessToken(args: {
  shop: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<ShopifyTokenResult> {
  const { shop, clientId, clientSecret, code } = args;

  const url = `https://${shop}/admin/oauth/access_token`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
    cache: "no-store",
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${text}`);
  }

  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Token exchange returned non-JSON: ${text}`);
  }

  const accessToken = String(json?.access_token || "").trim();
  if (!accessToken) {
    throw new Error(`Token exchange missing access_token: ${text}`);
  }

  const scope = typeof json?.scope === "string" ? json.scope : undefined;

  return { accessToken, scope };
}
