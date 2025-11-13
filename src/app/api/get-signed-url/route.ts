import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVEN_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY fehlt");
      return NextResponse.json(
        { error: "Missing ElevenLabs key" },
        { status: 500 }
      );
    }

    // 🔥 Das ist die richtige URL für @elevenlabs/react 0.5.0
    const url = "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // keine agent_id, keine Sessions
        // das war die funktionierende Version
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ ElevenLabs Fehler:", data);
      return NextResponse.json(
        { error: "ElevenLabs rejected request", details: data },
        { status: 500 }
      );
    }

    if (!data?.signed_url) {
      console.error("❌ signed_url fehlt:", data);
      return NextResponse.json(
        { error: "signed_url missing", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error("❌ SERVER ERROR:", err);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
