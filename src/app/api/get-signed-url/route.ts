// src/app/api/get-signed-url/route.ts
import { NextResponse } from "next/server";

/**
 * Diese Route erzeugt eine temporÃ¤re, signierte URL fÃ¼r die Verbindung
 * zwischen deinem Avatar und dem ElevenLabs-Realtime-API-Endpunkt.
 * 
 * Die Signatur wird von deinem Server (z. B. Node-Backend oder Next.js-Server)
 * erstellt, um den API-SchlÃ¼ssel nicht im Frontend preiszugeben.
 */
export async function POST(request: Request) {
  try {
    const { dynamicVariables } = await request.json();

    // Der API-SchlÃ¼ssel wird aus der .env geladen:
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      throw new Error("Fehlender ElevenLabs API-SchlÃ¼ssel (.env)");
    }

    // Anfrage an ElevenLabs: Signierte URL erzeugen
    const res = await fetch("https://api.elevenlabs.io/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        model: "eleven_multilingual_v2",
        voice: "Charlie",
        dynamic_variables: dynamicVariables || {},
      }),
    });

    const data = await res.json();
    return NextResponse.json({ signedUrl: data?.signed_url || null });
  } catch (e) {
    console.error("Fehler bei get-signed-url:", e);
    return NextResponse.json({ error: "Fehler beim Erstellen der signierten URL" }, { status: 500 });
  }
}

