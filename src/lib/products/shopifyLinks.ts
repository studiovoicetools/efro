// src/lib/products/shopifyLinks.ts

/**
 * Extrahiert aus einer Shopify GID (z. B. gid://shopify/Product/7512440471619)
 * die numerische ID. Wenn das Format nicht passt, wird null zurueckgegeben.
 */
export function extractNumericIdFromGid(gid: string): string | null {
  if (!gid) return null;
  if (!gid.startsWith("gid://")) {
    // vielleicht ist es schon eine normale ID
    return gid;
  }

  const parts = gid.split("/");
  const last = parts[parts.length - 1];
  return last || null;
}

/**
 * Baut einen Admin-Produktlink fuer Shopify:
 * https://{shopDomain}/admin/products/{numericId}
 */
export function buildShopifyAdminProductUrl(
  productId: string,
  shopDomain: string
): string | null {
  const numericId = extractNumericIdFromGid(productId);
  if (!numericId) return null;

  const cleanDomain = shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (!cleanDomain) return null;

  return `https://${cleanDomain}/admin/products/${numericId}`;
}
