import { NextResponse } from "next/server";

export async function GET() {
  const API_KEY = process.env.ELEVENLABS_API_KEY;
  const AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

  if (!API_KEY || !AGENT_ID) {
    return NextResponse.json(
      { error: "Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID" },
      { status: 500 }
    );
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${AGENT_ID}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "xi-api-key": API_KEY,
    },
  });

  if (!res.ok) {
    const error = await res.text();
    return NextResponse.json(
      { error: "ElevenLabs error", detail: error },
      { status: res.status }
    );
  }

  const json = await res.json();
  return NextResponse.json(json);
}
