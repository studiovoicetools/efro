// src/app/api/shopify-products/route.ts
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export async function GET() {
  try {
    const storeDomain = requireEnv(
      "SHOPIFY_STORE_DOMAIN",
      process.env.SHOPIFY_STORE_DOMAIN
    );
    const adminToken = requireEnv(
      "SHOPIFY_ADMIN_ACCESS_TOKEN",
      process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
    );

    const url = `https://${storeDomain}/admin/api/2024-01/products.json?limit=50`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": adminToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      console.error(
        "Shopify Product Error: HTTP",
        res.status,
        bodyText.slice(0, 500)
      );
      return NextResponse.json(
        { error: "Shopify API error", status: res.status },
        { status: 500 }
      );
    }

    const data = await res.json();
    const rawProducts = (data as any).products ?? [];

    // Mapping auf dein EfroProduct-Schema (ggf. Felder anpassen)
    const products = rawProducts.map((p: any) => ({
      id: String(p.id),
      title: p.title,
      description: p.body_html ?? "",
      category: p.product_type ?? "",
      price: p.variants?.[0]?.price
        ? Number(p.variants[0].price)
        : null,
      tags:
        typeof p.tags === "string"
          ? p.tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean)
          : [],
      imageUrl: p.image?.src ?? null,
      handle: p.handle,
    }));

    return NextResponse.json({ products });
  } catch (err) {
    console.error("Shopify Product Error:", err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
