// @ts-nocheck

/**
 * FINAL VERSION — GUARANTEED NEXT.JS 14 COMPATIBLE
 * Forced dynamic server execution with full logging.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

console.log("🔥 FINAL VERSION — getSignedUrl route loaded.");

import { NextResponse } from "next/server";

export async function POST() {
  console.log("🔵 getSignedUrl POST request received.");

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    console.log("apiKey:", apiKey ? "LOADED" : "MISSING");
    console.log("modelId:", modelId);
    console.log("voiceId:", voiceId);

    if (!apiKey) {
      console.error("❌ Missing ELEVENLABS_API_KEY.");
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY" },
        { status: 500 }
      );
    }

    const payload: any = {
      model_id: modelId,
    };

    if (voiceId) payload.voice = { voice_id: voiceId };

    console.log("📤 Sending to ElevenLabs:", payload);

    const res = await fetch(
      "https://api.elevenlabs.io/v1/realtime/signed-url",
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    console.log("📥 ElevenLabs status:", res.status);

    let data = null;
    try {
      data = await res.json();
      console.log("📥 ElevenLabs response:", data);
    } catch (err) {
      console.error("❌ Failed to parse JSON:", err);
      return NextResponse.json(
        { error: "Failed to parse ElevenLabs response" },
        { status: 500 }
      );
    }

    if (!res.ok) {
      console.error("❌ ElevenLabs failed:", data);
      return NextResponse.json(
        { error: "ElevenLabs request failed", details: data },
        { status: 500 }
      );
    }

    if (!data?.signed_url) {
      console.error("❌ No signed_url returned:", data);
      return NextResponse.json(
        { error: "Missing signed_url", details: data },
        { status: 500 }
      );
    }

    console.log("✅ signed_url created successfully.");
    return NextResponse.json({ url: data.signed_url });
  } catch (error) {
    console.error("❌ INTERNAL SERVER ERROR:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  console.log("🟢 GET request received for getSignedUrl.");
  return NextResponse.json({ ok: true, route: "getSignedUrl", version: "FINAL" });
}
