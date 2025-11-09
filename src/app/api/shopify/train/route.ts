import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const SHOPIFY_STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const SHOPIFY_STOREFRONT_TOKEN =
  process.env.SHOPIFY_STOREFRONT_TOKEN || process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error("Supabase-Umgebungsvariablen fehlen!");
    }
    if (!SHOPIFY_STORE_DOMAIN || !SHOPIFY_STOREFRONT_TOKEN) {
      throw new Error("Shopify-Umgebungsvariablen fehlen!");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const query = `
      {
        products(first: 50) {
          edges {
            node {
              id
              title
              handle
              vendor
              description
              featuredImage { url }
              variants(first: 1) {
                edges { node { price { amount } } }
              }
            }
          }
        }
      }
    `;

    const resp = await fetch(
      `https://${SHOPIFY_STORE_DOMAIN}/api/2025-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": SHOPIFY_STOREFRONT_TOKEN!,
        },
        body: JSON.stringify({ query }),
      }
    );

    const json = await resp.json();
    const edges = json?.data?.products?.edges;
    if (!edges) {
      return NextResponse.json({ success: false, error: "Shopify Storefront API request failed" });
    }

    const products = edges.map(({ node }: any) => {
      const id = node?.id ?? crypto.randomUUID();
      return {
        id,                                 // Primärschlüssel in products
        sku: id,                            // <- WICHTIG: SKU = Shopify GID
        title: node?.title ?? "Unbenanntes Produkt",
        handle: node?.handle ?? "",
        vendor: node?.vendor ?? "",
        description: node?.description ?? "",
        featuredImage: node?.featuredImage?.url ?? "",
        price: parseFloat(node?.variants?.edges?.[0]?.node?.price?.amount ?? "0") || 0,
      };
    });

    const { data, error } = await supabase
      .from("products")
      .upsert(products, { onConflict: "id" }); // konfliktziel bleibt id

    if (error) {
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true, count: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
