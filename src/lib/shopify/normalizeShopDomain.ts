export function normalizeShopDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  const s = String(input).trim();

  // already myshopify
  if (/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(s)) return s.toLowerCase();

  // admin.shopify.com/store/{store}
  const m = s.match(/^admin\.shopify\.com\/store\/([a-z0-9][a-z0-9-]*)/i);
  if (m?.[1]) return `${m[1].toLowerCase()}.myshopify.com`;

  return null;
}
