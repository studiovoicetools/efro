import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dynamicVariables } = body;

    const response = await fetch("https://api.mascot.bot/v1/get-signed-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MASCOT_BOT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        config: {
          provider: "elevenlabs",
          provider_config: {
            api_key: process.env.ELEVENLABS_API_KEY,
            agent_id: process.env.ELEVENLABS_AGENT_ID_SELLER,
            sample_rate: 16000,
            dynamic_variables: dynamicVariables ?? {},
          },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("MascotBot seller error:", response.status, text);
      return NextResponse.json(
        { error: "MascotBot returned " + response.status },
        { status: 500 }
      );
    }

    const data = await response.json();
    return NextResponse.json({ signedUrl: data.signed_url });
  } catch (error) {
    console.error("Error fetching signed URL (seller):", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL for seller" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
