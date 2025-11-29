import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { voiceId, text } = await req.json();

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_id: "eleven_monolingual_v1",
          text,
        }),
      }
    );

    const audio = await resp.arrayBuffer();

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "preview_failed" }, { status: 500 });
  }
}
