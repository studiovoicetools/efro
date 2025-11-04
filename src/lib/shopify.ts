// src/lib/shopify.ts
// ---------------------------------------------
// Shopify Storefront API Helper
// ---------------------------------------------

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_STOREFRONT_TOKEN!;

if (!domain || !token) {
  throw new Error("❌ Shopify environment variables missing!");
}

/**
 * Universelle Fetch-Funktion für Storefront-GraphQL-Abfragen.
 */
export async function shopifyFetch<T>(
  query: string,
  variables: Record<string, any> = {},
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
    ...init,
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok || json.errors) {
    console.error("Shopify Storefront error:", json.errors || res.statusText);
    throw new Error("Shopify Storefront API request failed");
  }

  return json.data;
}

// ---------------------------------------------------------
//  GraphQL Queries & Mutations für Cart und Produkte
// ---------------------------------------------------------

export const CART_CREATE = /* GraphQL */ `
  mutation CartCreate($lines: [CartLineInput!], $buyerIdentity: CartBuyerIdentityInput) {
    cartCreate(input: { lines: $lines, buyerIdentity: $buyerIdentity }) {
      cart {
        id
        checkoutUrl
      }
      userErrors { field message }
    }
  }
`;

export const CART_LINES_ADD = /* GraphQL */ `
  mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
    cartLinesAdd(cartId: $cartId, lines: $lines) {
      cart {
        id
        checkoutUrl
      }
      userErrors { field message }
    }
  }
`;

export const CART_QUERY = /* GraphQL */ `
  query CartQuery($cartId: ID!) {
    cart(id: $cartId) {
      id
      checkoutUrl
      lines(first: 50) {
        edges {
          node {
            id
            quantity
            merchandise {
              ... on ProductVariant {
                id
                title
                product {
                  title
                  handle
                }
              }
            }
          }
        }
      }
    }
  }
`;

export const PRODUCT_DEFAULT_VARIANT = /* GraphQL */ `
  query ProductDefaultVariant($handle: String!) {
    product(handle: $handle) {
      id
      title
      variants(first: 1) {
        edges {
          node {
            id
            title
          }
        }
      }
    }
  }
`;

