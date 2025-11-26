// src/lib/shops/onboardViaApi.ts

export type OnboardShopPayload = {
  shopDomain: string;
  brandName?: string;
  mainCategory?: string;
  targetAudience?: string;
  priceLevel?: string;
  language?: string;
  plan?: string;
};

/**
 * Ruft deinen bestehenden /api/efro/onboard-shop Endpoint auf.
 * Wird z.B. vom Shopify-Callback genutzt.
 */
export async function onboardShopViaApi(
  payload: OnboardShopPayload
): Promise<void> {
  const baseUrl =
    process.env.INTERNAL_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000";

  const url = `${baseUrl.replace(/\/+$/, "")}/api/efro/onboard-shop`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    // Wichtig: JSON.stringify
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[onboardShopViaApi] Failed", {
      status: res.status,
      statusText: res.statusText,
      body: text,
    });
    throw new Error(
      `onboardShopViaApi failed with status ${res.status}: ${res.statusText}`
    );
  }

  const json = await res.json().catch(() => null);
  console.log("[onboardShopViaApi] Success", json);
}
