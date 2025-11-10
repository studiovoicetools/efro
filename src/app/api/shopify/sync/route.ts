// src/app/api/shopify/sync/route.ts
import { NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const query = `
      {
        products(first: 3) {
          edges {
            node {
              id
              title
              handle
              featuredImage {
                url
              }
            }
          }
        }
      }
    `;

    const data = await shopifyFetch(query);
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error("âŒ Shopify Sync Error:", err.message);
    return NextResponse.json({
      success: false,
      error: err.message,
      domain: process.env.SHOPIFY_STORE_DOMAIN,
      tokenPreview: process.env.SHOPIFY_STOREFRONT_TOKEN?.slice(0, 8) + "...",
    });
  }
}
