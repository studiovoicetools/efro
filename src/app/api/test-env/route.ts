import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN || null,
    SHOPIFY_STOREFRONT_TOKEN: process.env.SHOPIFY_STOREFRONT_TOKEN || null,
    SHOPIFY_STOREFRONT_ACCESS_TOKEN: process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN || null,
    SUPABASE_URL: process.env.SUPABASE_URL || null,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? "***" : null,
  });
}
