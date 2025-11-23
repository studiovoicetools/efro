import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      dynamicVariables?: Record<string, any>;
    };

    const dynamicFromBody = body?.dynamicVariables || {};
    const shopDomain =
      (dynamicFromBody?.shopDomain as string) || "local-dev";

    let dynamicVariables: Record<string, any> = { ...dynamicFromBody };

    // Produkte aus EFRO-Pipeline holen und fuer ElevenLabs aufbereiten
    try {
      const origin = new URL(request.url).origin;
      const url = `${origin}/api/efro/debug-products?shop=${encodeURIComponent(
        shopDomain
      )}`;

      const res = await fetch(url, { cache: "no-store" });

      if (!res.ok) {
        const txt = await res.text();
        console.error(
          "Seller get-signed-url: debug-products failed",
          res.status,
          txt
        );
      } else {
        const data = await res.json();
        const products = (data.products || []) as any[];

        const productsForAgent = products.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          image_url: p.imageUrl ?? p.image_url ?? null,
          url: p.productUrl ?? p.url ?? null,
          category: p.category ?? null,
        }));

        const productDetailsForAgent = products.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description ?? "",
          price: p.price,
          availability: "in_stock",
          image_url: p.imageUrl ?? p.image_url ?? null,
          category: p.category ?? null,
          url: p.productUrl ?? p.url ?? null,
        }));

        dynamicVariables = {
          ...dynamicVariables,
          products: productsForAgent,
          product_details: productDetailsForAgent,
        };
      }
    } catch (err) {
      console.error("Seller get-signed-url: product enrichment error", err);
    }

    // Signierte URL ueber MascotBot holen
    const response = await fetch("https://api.mascot.bot/v1/get-signed-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MASCOT_BOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          provider: "elevenlabs",
          provider_config: {
            agent_id: process.env.ELEVENLABS_AGENT_ID_SELLER,
            api_key: process.env.ELEVENLABS_API_KEY,
            dynamic_variables: dynamicVariables,
          },
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to get signed URL (seller):", errorText);
      return NextResponse.json(
        { error: "Failed to get signed URL" },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("Error fetching signed URL (seller):", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}

// Force dynamic to prevent caching issues
export const dynamic = "force-dynamic";
