import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVEN_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY fehlt!");
      return NextResponse.json(
        { error: "Missing ElevenLabs key" },
        { status: 500 }
      );
    }

    // Korrekte URL für @elevenlabs/react 0.5.0
    const url = "https://api.elevenlabs.io/v1/realtime/signed_url";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // dieser agent_id Wert ist bei Realtime optional
        agent_id: "default",
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
      console.error("❌ KEIN signed_url:", data);
      return NextResponse.json(
        { error: "signed_url missing", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("❌ SERVER ERROR:", error);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
