import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { dynamicVariables } = await request.json();

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVEN_API_KEY) {
      console.error("❌ ELEVENLABS_API_KEY fehlt!");
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    // Signed URL Anfrage an ElevenLabs
    const response = await fetch(
      "https://api.elevenlabs.io/v1/convai/agent/signed-url",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": ELEVEN_API_KEY,
        },
        body: JSON.stringify({
          agent_id: "default",   // bei dir meistens "default"
          dynamic_variables: dynamicVariables || {},
        }),
      }
    );

    const data = await response.json();

    if (!data?.signed_url) {
      console.error("❌ ElevenLabs gab KEIN signed_url zurück:", data);
      return NextResponse.json(
        { error: "Signed URL missing", details: data },
        { status: 500 }
      );
    }

    // Wichtig: gleiche Schreibweise wie im Frontend erwartet!
    return NextResponse.json({ signedUrl: data.signed_url }, { status: 200 });

  } catch (err) {
    console.error("❌ SERVER ERROR in /get-signed-url:", err);
    return NextResponse.json({ error: "Server failed" }, { status: 500 });
  }
}
