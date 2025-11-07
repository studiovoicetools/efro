export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";




export async function GET(request: NextRequest) {
  try {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
    const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!storeDomain || !accessToken) {
      console.error("❌ Shopify API Credentials fehlen!");
      return NextResponse.json({ error: "Shopify credentials missing" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "";

    const url = `https://${storeDomain}/admin/api/2024-01/products.json`;
    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Shopify API Error:", errorText);
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    let products = data.products || [];

    if (category) {
      const searchTerm = category.toLowerCase();
      products = products.filter((p: any) =>
        [p.title, p.tags, p.product_type].some((f: string) =>
          f?.toLowerCase().includes(searchTerm)
        )
      );
    }

    const formatted = products.map((p: any) => ({
      id: p.id.toString(),
      title: p.title,
      handle: p.handle,
      imageUrl: p.images?.[0]?.src || null,
      price: p.variants?.[0]?.price || "0.00",
      available: p.status === "active",
      url: `https://${storeDomain}/products/${p.handle}`,
    }));

    return NextResponse.json({
      success: true,
      products: formatted,
      total: formatted.length,
    });
  } catch (err: any) {
    console.error("❌ Shopify Products Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


