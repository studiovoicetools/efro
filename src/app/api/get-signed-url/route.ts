import { NextResponse } from "next/server";

export async function POST() {
  try {
    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;

    if (!ELEVEN_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY fehlt!");
      return NextResponse.json(
        { error: "Missing ElevenLabs key" },
        { status: 500 }
      );
    }

    // WICHTIG:
    // Das Realtime-Endpoint für @elevenlabs/react 0.5.0 ist:
    //   GET https://api.elevenlabs.io/v1/realtime/signed_url
    // also: wir SELBST (Next-API) bleiben POST,
    // aber Richtung ElevenLabs machen wir einen GET.

    const url = "https://api.elevenlabs.io/v1/realtime/signed_url";

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
      },
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

    // Frontend erwartet exakt dieses Feld:
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("❌ SERVER ERROR:", error);
    return NextResponse.json({ error: "Server crashed" }, { status: 500 });
  }
}
