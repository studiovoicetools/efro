import { NextResponse } from "next/server";

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export async function GET() {
  if (!domain || !token) {
    return NextResponse.json(
      { ok: false, error: "Missing Shopify environment variables" },
      { status: 500 }
    );
  }

  const query = `
    query {
      products(first: 3) {
        edges {
          node {
            id
            title
            featuredImage { url }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(`https://${domain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token
      },
      body: JSON.stringify({ query }),
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: "Shopify request failed", status: res.status },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (e) {
  const err = e instanceof Error ? e.message : String(e);
  return NextResponse.json(
    { ok: false, error: err },
    { status: 500 }
  );
}

}
