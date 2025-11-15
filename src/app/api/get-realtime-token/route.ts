import { NextResponse } from "next/server";

export async function GET() {
  try {
    const elevenResponse = await fetch(
      "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_2701ka2f7592ecatmva2kwec63nw",
      { method: "GET", headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } }
    );

    const data = await elevenResponse.json();

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Token error" }, { status: 500 });
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
