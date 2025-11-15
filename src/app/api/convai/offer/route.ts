// src/app/api/convai/offer/route.ts
import { NextRequest } from "next/server";

const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY!;
const ELEVEN_AGENT_ID = process.env.ELEVENLABS_AGENT_ID!;

export async function POST(req: NextRequest) {
  if (!ELEVEN_API_KEY || !ELEVEN_AGENT_ID) {
    return new Response("Missing ElevenLabs env vars", { status: 500 });
  }

  try {
    const { sdp } = await req.json();

    if (!sdp || typeof sdp !== "string") {
      return new Response("Missing sdp in body", { status: 400 });
    }

    // 1) Conversation token holen
    const tokenRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${ELEVEN_AGENT_ID}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVEN_API_KEY,
        },
        cache: "no-store",
      }
    );

    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      return new Response(
        `Token request failed: ${tokenRes.status} - ${txt}`,
        { status: 500 }
      );
    }

    const { token } = (await tokenRes.json()) as { token: string };

    // 2) Offer an ElevenLabs schicken
    const offerRes = await fetch(
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

    if (!offerRes.ok) {
      const txt = await offerRes.text();
      return new Response(
        `Offer failed: ${offerRes.status} - ${txt}`,
        { status: 500 }
      );
    }

    const answerSDP = await offerRes.text();

    // direkt als SDP zurueckgeben
    return new Response(answerSDP, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
      },
    });
  } catch (err: any) {
    console.error("convai/offer error", err);
    return new Response("Internal error in convai/offer", { status: 500 });
  }
}
