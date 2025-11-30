// src/app/api/get-signed-url-seller/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getShopMeta } from "@/lib/shops/meta";
import { touchShopLastSeen } from "@/lib/shops/db";
import { resolveVoiceForAvatar } from "@/lib/voices/avatarVoices";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";
import type { VoiceKey } from "@/lib/voices/voiceCatalog";

/**
 * Holt eine signed URL von ElevenLabs über das Mascot Bot Proxy-API.
 * Wird vom Avatar-Seller-Frontend aufgerufen.
 */
async function createSignedUrlFromElevenLabs(
  agentId: string,
  dynamicVariables: any
): Promise<string> {
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
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      "[get-signed-url-seller] Failed to get signed URL:",
      errorText
    );
    throw new Error("Failed to get signed URL from Mascot Bot");
  }

  const data = await response.json();

  if (!data?.signed_url) {
    console.error(
      "[get-signed-url-seller] Response without signed_url field:",
      data
    );
    throw new Error("Mascot Bot did not return a signed_url");
  }

  return data.signed_url;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[get-signed-url-seller] ENTER POST handler");

    const body = await request.json().catch(() => ({}));
    const incomingDynamic = body?.dynamicVariables ?? {};

    // Shop-Domain bestimmen (vom Client oder Fallback auf local-dev)
    const fallbackShop =
      incomingDynamic.shopDomain ?? body?.shopDomain ?? "local-dev";

    // Shop-Metadaten aus DB (oder Fallback) holen
    const meta = await getShopMeta(fallbackShop);

    // Last-Seen-Tracking (Fire & Forget)
    touchShopLastSeen(meta.shopDomain).catch((err) => {
      console.error("[get-signed-url-seller] touchShopLastSeen error", err);
    });

    console.log("[get-signed-url-seller] Shop Meta", {
      fallbackShop,
      meta,
    });

    // Finale dynamicVariables zusammenbauen:
    // - was vom Client kommt
    // - plus Shop-Info aus DB
    const finalDynamicVariables = {
      ...incomingDynamic,
      language: meta.language ?? incomingDynamic.language ?? "de",
      shopDomain: fallbackShop,
      shopInfo: {
        brandName: meta.brandName,
        mainCategory: meta.mainCategory,
        targetAudience: meta.targetAudience,
        priceLevel: meta.priceLevel,
        country: meta.country,
        currency: meta.currency,
        toneOfVoice: meta.toneOfVoice,
        plan: meta.plan,
      },
    };

    console.log("[get-signed-url-seller] Final dynamic variables", {
      fallbackShop,
      finalDynamicVariables,
    });

    // TODO: use real selected avatarId from context/store
    // Aktuell: Default auf "bear", später aus Shop-Meta oder Client-Request
    const avatarId: EfroAvatarId = (incomingDynamic.avatarId as EfroAvatarId) ?? "bear";
    const preferredVoiceKey: VoiceKey | null = (incomingDynamic.preferredVoiceKey as VoiceKey) ?? null;

    // Voice für Avatar auflösen
    const resolved = resolveVoiceForAvatar({ avatarId, preferredVoiceKey });

    if (!resolved.agentId) {
      console.warn("[get-signed-url-seller] No agentId resolved, falling back to legacy ELEVENLABS_AGENT_ID");
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

    const signedUrl = await createSignedUrlFromElevenLabs(
      resolved.agentId,
      finalDynamicVariables
    );

    return NextResponse.json({ signedUrl });
  } catch (error) {
    console.error("[get-signed-url-seller] Error fetching signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}

// wichtig, damit Next das nicht cached
export const dynamic = "force-dynamic";
