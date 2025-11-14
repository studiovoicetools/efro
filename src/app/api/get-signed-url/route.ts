import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVEN_API_KEY) {
      return NextResponse.json(
        { error: "Missing ELEVENLABS_API_KEY" },
        { status: 500 }
      );
    }

    const res = await fetch("https://api.elevenlabs.io/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Default realtime options – can be empty
        model_id: "eleven_multilingual_v2"
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ ElevenLabs API error:", data);
      return NextResponse.json(
        { error: "Failed to create session", details: data },
        { status: 500 }
      );
    }

    if (!data?.ws_url) {
      return NextResponse.json(
        { error: "Missing ws_url in response", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.ws_url });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
