export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
// src/app/api/shopify-products/route.ts
import { NextResponse } from "next/server";

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

export async function GET() {
  try {
    if (!SHOP_DOMAIN || !ADMIN_TOKEN) {
      console.error("[Shopify Products] Missing env", {
        hasDomain: !!SHOP_DOMAIN,
        hasToken: !!ADMIN_TOKEN,
      });

      return jsonUtf8(
        { error: "Shopify env vars missing on server" },
        { status: 500 }
      );
    }

    const url = `https://${SHOP_DOMAIN}/admin/api/2024-01/products.json?limit=50`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": ADMIN_TOKEN,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // wichtig: kein veraltetes Caching im Prod
      cache: "no-store",
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error("[Shopify Products] Non-OK response", {
        status: res.status,
        bodyText,
      });

      return jsonUtf8(
        {
          error: "Shopify products fetch failed",
          status: res.status,
          body: bodyText,
        },
        { status: 500 }
      );
    }

    const data = await res.json();

    // optional: eine klare Source kennzeichnen
    return jsonUtf8({
      source: "shopify-admin",
      ...data,
    });
  } catch (err) {
    console.error("[Shopify Products] Fetch threw", err);
    return jsonUtf8({ error: "failed" }, { status: 500 });
  }
}
