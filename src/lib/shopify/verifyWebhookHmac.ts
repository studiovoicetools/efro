export const runtime = "nodejs";

import crypto from "crypto";

type HeaderGetter = {
  get(name: string): string | null;
};

export function verifyShopifyWebhookHmac(
  headers: HeaderGetter,
  rawBody: Buffer,
  secret: string
): boolean {
  if (!secret) return false;

  const hmacRaw =
    headers.get("x-shopify-hmac-sha256") ||
    headers.get("X-Shopify-Hmac-Sha256") ||
    "";

  const hmac = hmacRaw.trim();
  if (!hmac) return false;

  const digestB64 = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  // timingSafeEqual wirft, wenn Längen abweichen – deshalb vorher prüfen
  let a: Buffer;
  let b: Buffer;

  try {
    a = Buffer.from(hmac, "base64");
    b = Buffer.from(digestB64, "base64");
  } catch {
    return false;
  }

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
