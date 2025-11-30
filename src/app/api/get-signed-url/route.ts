import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";
import { resolveVoiceForAvatar } from "@/lib/voices/avatarVoices";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";
import type { VoiceKey } from "@/lib/voices/voiceCatalog";

/**
 * Erstellt eine signed URL von ElevenLabs über Mascot Bot
 */
async function createSignedUrlFromElevenLabs(
  agentId: string,
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
            agent_id: agentId,
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

    // TODO: use real selected avatarId from context/store
    // Aktuell: Default auf "bear", später aus Shop-Meta oder Client-Request
    const avatarId: EfroAvatarId = (incomingDynamic.avatarId as EfroAvatarId) ?? "bear";
    const preferredVoiceKey: VoiceKey | null = (incomingDynamic.preferredVoiceKey as VoiceKey) ?? null;

    // Voice für Avatar auflösen
    const resolved = resolveVoiceForAvatar({ avatarId, preferredVoiceKey });

    if (!resolved.agentId) {
      console.warn("[get-signed-url] No agentId resolved, falling back to legacy ELEVENLABS_AGENT_ID");
      // Fallback auf Legacy-Verhalten
      const legacyAgentId = process.env.ELEVENLABS_AGENT_ID || "";
      if (!legacyAgentId) {
        return NextResponse.json(
          { error: "No voice configuration available" },
          { status: 500 }
        );
      }
      const signedUrl = await createSignedUrlFromElevenLabs(legacyAgentId, finalDynamicVariables);
      return NextResponse.json({ signedUrl });
    }

    console.log("[EFRO Voice] Using voice", resolved.voiceKey, "for avatar", avatarId, "agentId:", resolved.agentId);

    // Signed URL von ElevenLabs erstellen
    const signedUrl = await createSignedUrlFromElevenLabs(resolved.agentId, finalDynamicVariables);

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
