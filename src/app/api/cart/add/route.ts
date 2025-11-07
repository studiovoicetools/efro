export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/cart/add/route.ts
import { NextResponse } from "next/server";

/**
 * FÃ¼gt ein Produkt in den Warenkorb ein und gibt die Checkout-URL zurÃ¼ck.
 * Diese Route funktioniert mit der Shopify Storefront API.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { handle, quantity } = body;

    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_STOREFRONT_TOKEN;

    if (!domain || !token) throw new Error("Fehlende Shopify Umgebungsvariablen");

    // Schritt 1: Produkt-ID Ã¼ber Handle abrufen
    const queryProduct = `
      query GetProductID($handle: String!) {
        productByHandle(handle: $handle) { id }
      }
    `;
    const resProduct = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query: queryProduct, variables: { handle } }),
    });
    const dataProduct = await resProduct.json();
    const productId = dataProduct?.data?.productByHandle?.id;
    if (!productId) throw new Error("Produkt nicht gefunden");

    // Schritt 2: Warenkorb erstellen
    const mutation = `
      mutation CreateCart($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart {
            id
            checkoutUrl
          }
        }
      }
    `;
    const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { lines: [{ merchandiseId: productId, quantity: quantity || 1 }] },
      }),
    });

    const result = await res.json();
    const cart = result?.data?.cartCreate?.cart;

    return NextResponse.json({
      success: !!cart?.checkoutUrl,
      checkoutUrl: cart?.checkoutUrl || null,
    });
  } catch (e) {
    console.error("Fehler bei cart/add:", e);
    return NextResponse.json({ success: false, error: (e as Error).message });
  }
}


