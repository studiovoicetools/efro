// src/lib/shopify.ts
const domain =
  process.env.SHOPIFY_STORE_DOMAIN?.replace(/^https?:\/\//, "") || "";
const token =
  process.env.SHOPIFY_STOREFRONT_TOKEN ||
  process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN ||
  "";

if (!domain || !token) {
  console.error("? Missing Shopify domain or token");
}

export async function shopifyFetch(query: string, variables: Record<string, any> = {}) {
  try {
    const response = await fetch(`https://${domain}/api/2025-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify Storefront API request failed: ${response.status} - ${text}`);
    }

    const json = await response.json();
    if (json.errors) {
      console.error("Shopify GraphQL errors:", json.errors);
      throw new Error(JSON.stringify(json.errors));
    }

    return json.data;
  } catch (error: any) {
    console.error("? Shopify Fetch Error:", error.message);
    throw error;
  }
}
