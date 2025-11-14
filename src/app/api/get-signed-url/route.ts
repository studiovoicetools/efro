import { NextResponse } from "next/server";

export async function POST() {
  console.log("🔵 get-signed-url: request started");

  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const modelId = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    console.log("apiKey:", apiKey ? "LOADED" : "MISSING");
    console.log("modelId:", modelId);
    console.log("voiceId:", voiceId);

    if (!apiKey) {
      console.error("❌ Missing ELEVENLABS_API_KEY");
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY" },
        { status: 500 }
      );
    }

    const payload: any = {
      model_id: modelId,
    };

    if (voiceId) {
      payload.voice = { voice_id: voiceId };
    }

    console.log("📤 Sending request to ElevenLabs:", payload);

    const res = await fetch("https://api.elevenlabs.io/v1/realtime/signed-url", {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    console.log("📥 ElevenLabs status:", res.status);

    const data = await res.json().catch((err) => {
      console.error("❌ Failed to parse JSON:", err);
      return null;
    });

    console.log("📥 ElevenLabs response:", data);

    if (!res.ok) {
      console.error("❌ ElevenLabs error:", data);
      return NextResponse.json(
        { error: "ElevenLabs failed", details: data },
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

    console.log("✅ Signed URL created successfully");
    return NextResponse.json({ url: data.signed_url });
  } catch (error: any) {
    console.error("❌ Internal Error:", error.message);
    return NextResponse.json(
      { error: "Internal Error", details: error.message },
      { status: 500 }
    );
  }
}
