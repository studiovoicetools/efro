import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const sdp = await req.text();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");

  const elevenRes = await fetch(
    "https://api.elevenlabs.io/v1/convai/conversation/offer",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
      body: sdp,
    }
  );

  const answer = await elevenRes.text();

  return new NextResponse(answer, {
    status: 200,
    headers: {
      "Content-Type": "application/sdp",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
