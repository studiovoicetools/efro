import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_KEY) {
      return NextResponse.json({ error: "Missing ELEVENLABS_API_KEY" }, { status: 500 });
    }

    const url = "https://api.elevenlabs.io/v1/convai/conversation/get_signed_url";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agent_id: "agent",            // Pflicht
        connection_type: "websocket", // Pflicht
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("ElevenLabs Fehler:", data);
      return NextResponse.json({ error: "ElevenLabs rejected", details: data }, { status: 500 });
    }

    if (!data?.signed_url) {
      console.error("SIGNED_URL fehlte:", data);
      return NextResponse.json({ error: "Missing signed_url", details: data }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (err) {
    console.error("SERVER CRASH:", err);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
