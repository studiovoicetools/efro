import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "*";

  // Shopify Domains erlauben
  const allowedOrigins = [
    "https://avatarsalespro-dev.myshopify.com",
    "https://avatarsalespro-dev.myshopify.com/"
  ];

  const isAllowed = allowedOrigins.includes(origin);

  try {
    // Token von ElevenLabs holen
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY || ""
        }
      }
    );

    const data = await response.json();

    return new NextResponse(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": isAllowed ? origin : "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
      }
    });
  } catch (error) {
    console.error("Realtime Token Error:", error);
    return new NextResponse(
      JSON.stringify({ error: "Token fetch failed" }),
      { status: 500 }
    );
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin") || "*";
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
