import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const origin = req.headers.get("origin") || "*";

  // Erlaube Shopify → dein Dev-Shop
  const allowedOrigins = [
    "https://avatarsalespro-dev.myshopify.com",
    "https://avatarsalespro-dev.myshopify.com/",
    "https://avatarsalespro-dev.myshopify.com/admin"
  ];

  const isAllowed = allowedOrigins.includes(origin);

  // Token generieren
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${process.env.ELEVENLABS_AGENT_ID}`,
    {
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! }
    }
  );

  const data = await res.json();

  return new NextResponse(JSON.stringify(data), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": isAllowed ? origin : "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
