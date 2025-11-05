// src/app/api/shopify-products/route.ts
import { NextResponse } from "next/server";

/**
 * Diese Route lÃ¤dt Produkte aus deinem Shopify-Store (Storefront-API).
 * Sie kann optional nach Kategorie (z. B. "hoodie") filtern.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!domain || !token) {
      throw new Error("Fehlende Shopify Umgebungsvariablen (.env)");
    }

    const query = `
      query GetProducts($query: String) {
        products(first: 10, query: $query) {
          edges {
            node {
              id
              title
              handle
              onlineStoreUrl
              availableForSale
              featuredImage { url altText }
              priceRange {
                minVariantPrice { amount currencyCode }
                maxVariantPrice { amount currencyCode }
              }
            }
          }
        }
      }
    `;

    const variables = {
      query: category ? `title:${category}` : "",
    };

    const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await res.json();
    const edges = result?.data?.products?.edges || [];

    const products = edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      url: edge.node.onlineStoreUrl,
      available: edge.node.availableForSale,
      price: edge.node.priceRange.minVariantPrice.amount,
      imageUrl: edge.node.featuredImage?.url,
      imageAlt: edge.node.featuredImage?.altText || "",
      category: category || "allgemein",
    }));

    return NextResponse.json({ success: true, products });
  } catch (e) {
    console.error("Fehler bei shopify-products:", e);
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}

