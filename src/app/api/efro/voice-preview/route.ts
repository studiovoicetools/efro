/**
 * EFRO Voice Preview API
 * 
 * Generiert eine TTS-Audio-Preview für die Onboarding-Voice-Auswahl.
 * Nutzt resolveVoiceForAvatar, um die korrekte agentId zu bestimmen.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveVoiceForAvatar } from "@/lib/voices/avatarVoices";
import type { EfroAvatarId } from "@/lib/efro/mascotConfig";
import { VOICES, type VoiceKey } from "@/lib/voices/voiceCatalog";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, avatarId, preferredVoiceKey } = body;

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'text' parameter" },
        { status: 400 }
      );
    }

    const avatarIdTyped: EfroAvatarId = (avatarId as EfroAvatarId) ?? "bear";
    const preferredVoiceKeyTyped: VoiceKey | null = preferredVoiceKey
      ? (preferredVoiceKey as VoiceKey)
      : null;

    console.log("[EFRO VoicePreview] Request", {
      avatarId: avatarIdTyped,
      preferredVoiceKey: preferredVoiceKeyTyped,
      textLength: text.length,
    });

    // Voice für Avatar auflösen
    const resolved = resolveVoiceForAvatar({
      avatarId: avatarIdTyped,
      preferredVoiceKey: preferredVoiceKeyTyped,
    });

    const selectedVoice =
      (preferredVoiceKeyTyped &&
        VOICES.find((v) => v.key === preferredVoiceKeyTyped)) ||
      VOICES.find((v) => v.key === (resolved.voiceKey as VoiceKey)) ||
      VOICES[0];

    const voiceId = selectedVoice?.agentId;

    if (!voiceId) {
      console.error("[EFRO VoicePreview] No voiceId for preview", {
        preferredVoiceKey: preferredVoiceKeyTyped,
        resolvedVoiceKey: resolved.voiceKey,
      });
      return NextResponse.json(
        { error: "No voiceId available for preview" },
        { status: 500 }
      );
    }

    console.log("[EFRO VoicePreview] Using voiceId for preview", {
      voiceId: voiceId.substring(0, 12) + "...",
      preferredVoiceKey: preferredVoiceKeyTyped,
      resolvedVoiceKey: resolved.voiceKey,
    });

    // ElevenLabs TTS direkt aufrufen
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      console.error("[EFRO VoicePreview] Missing ELEVENLABS_API_KEY");
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 }
      );
    }

    // ElevenLabs TTS API: text-to-speech mit voiceId
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": elevenLabsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "eleven_multilingual_v2",
          text: text,
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("[EFRO VoicePreview] ElevenLabs TTS failed", {
        status: ttsResponse.status,
        error: errorText,
      });

      // Fallback: Versuche mit eleven_monolingual_v1
      const fallbackResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenLabsApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model_id: "eleven_monolingual_v1",
            text: text,
          }),
        }
      );

      if (!fallbackResponse.ok) {
        const fallbackError = await fallbackResponse.text();
        console.error("[EFRO VoicePreview] Fallback TTS also failed", {
          status: fallbackResponse.status,
          error: fallbackError,
        });
        return NextResponse.json(
          { error: "TTS generation failed", details: fallbackError },
          { status: 500 }
        );
      }

      const audioBuffer = await fallbackResponse.arrayBuffer();
      const base64 = Buffer.from(audioBuffer).toString("base64");
      const audioUrl = `data:audio/mpeg;base64,${base64}`;

      return NextResponse.json({ audioUrl });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();
    const base64 = Buffer.from(audioBuffer).toString("base64");
    const audioUrl = `data:audio/mpeg;base64,${base64}`;

    return NextResponse.json({ audioUrl });
  } catch (error: any) {
    console.error("[EFRO VoicePreview] Error", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

