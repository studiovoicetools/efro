import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";

/**
 * Erstellt eine signed URL von ElevenLabs über Mascot Bot
 */
async function createSignedUrlFromElevenLabs(
  dynamicVariables: any
): Promise<string> {
  // Use Mascot Bot proxy endpoint for automatic viseme injection
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
          agent_id: process.env.ELEVENLABS_AGENT_ID,
          api_key: process.env.ELEVENLABS_API_KEY,
          ...(dynamicVariables && { dynamic_variables: dynamicVariables }),
        },
      },
    }),
    // Ensure fresh URL for WebSocket avatar connection
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to get signed URL:", errorText);
    throw new Error("Failed to get signed URL");
  }

  const data = await response.json();
  return data.signed_url;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incomingDynamic = body.dynamicVariables ?? {};

    // Shop-Domain bestimmen (mit Fallback)
    const fallbackShop =
      incomingDynamic.shopDomain ?? body?.shopDomain ?? "local-dev";

    // Shop-Metadaten holen
    const meta = await getShopMeta(fallbackShop);

    // Optional: Logging für Debugging
    console.log("[get-signed-url] Shop Meta", {
      fallbackShop,
      meta,
    });

    // Finale dynamicVariables mit Shop-Info zusammenbauen
    const finalDynamicVariables = {
      ...incomingDynamic,
      language: meta.language ?? incomingDynamic.language ?? "de",
      shopDomain: fallbackShop,
      shopInfo: {
        brandName: meta.brandName,
        mainCategory: meta.mainCategory,
        targetAudience: meta.targetAudience,
        priceLevel: meta.priceLevel,
      },
    };

    // Signed URL von ElevenLabs erstellen
    const signedUrl = await createSignedUrlFromElevenLabs(finalDynamicVariables);

    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error("Error fetching signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}

// Force dynamic to prevent caching issues
export const dynamic = "force-dynamic";
