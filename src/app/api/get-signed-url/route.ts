// src/app/api/get-signed-url-seller/route.ts
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DynamicVariables = Record<string, string>;

interface MascotSignedUrlResponse {
  signed_url?: string;
  [key: string]: unknown;
}

function maskToken(token: string | undefined | null): string {
  if (!token) return "[undefined]";
  if (token.length <= 8) return `[len=${token.length}] ${"*".repeat(token.length)}`;
  const start = token.slice(0, 4);
  const end = token.slice(-4);
  return `[len=${token.length}] ${start}****${end}`;
}

function sanitizeDynamicVariables(input: unknown): DynamicVariables | undefined {
  if (!input || typeof input !== "object") return undefined;
  const result: DynamicVariables = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key === "string" && typeof value === "string") {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

async function createSignedUrlFromMascot(params: {
  mascotApiKey: string;
  elevenApiKey: string;
  elevenAgentId: string;
  dynamicVariables?: DynamicVariables;
}) {
  const { mascotApiKey, elevenApiKey, elevenAgentId, dynamicVariables } = params;

  console.log("[get-signed-url-seller] Calling Mascot get-signed-url", {
    mascotKeyMasked: maskToken(mascotApiKey),
    elevenKeyMasked: maskToken(elevenApiKey),
    agentIdMasked: maskToken(elevenAgentId),
    hasDynamicVariables: !!dynamicVariables,
  });

  const response = await fetch("https://api.mascot.bot/v1/get-signed-url", {
    method: "POST",
    headers: {
      // 🔐 genau wie in der offiziellen Mascot-Doku:
      // Authorization: Bearer <token>
      Authorization: `Bearer ${mascotApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      config: {
        provider: "elevenlabs",
        provider_config: {
          api_key: elevenApiKey,
          agent_id: elevenAgentId,
          sample_rate: 16000,
          ...(dynamicVariables && { dynamic_variables: dynamicVariables }),
        },
      },
    }),
    cache: "no-store",
  });

  const rawText = await response.text().catch(() => "");

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = rawText ? JSON.parse(rawText) : undefined;
    } catch {
      parsed = rawText || undefined;
    }

    console.error("[get-signed-url-seller] Mascot error", {
      status: response.status,
      statusText: response.statusText,
      raw: parsed,
    });

    throw new Error(
      `Mascot get-signed-url returned ${response.status} (${response.statusText})`
    );
  }

  let data: MascotSignedUrlResponse;
  try {
    data = rawText ? (JSON.parse(rawText) as MascotSignedUrlResponse) : {};
  } catch (err) {
    console.error(
      "[get-signed-url-seller] Failed to parse Mascot JSON response",
      err,
      rawText
    );
    throw new Error("Mascot response is not valid JSON");
  }

  const signedUrl = data?.signed_url;
  if (!signedUrl || typeof signedUrl !== "string") {
    console.error(
      "[get-signed-url-seller] Mascot response missing signed_url",
      data
    );
    throw new Error("Mascot response does not contain signed_url");
  }

  console.log("[get-signed-url-seller] Signed URL received");
  return signedUrl;
}

export async function POST(request: NextRequest) {
  try {
    // 🔹 Body robust lesen
    let dynamicVariables: DynamicVariables | undefined;

    try {
      const body = (await request.json().catch(() => ({}))) as {
        dynamicVariables?: unknown;
      };
      dynamicVariables = sanitizeDynamicVariables(body.dynamicVariables);
    } catch (err) {
      console.warn(
        "[get-signed-url-seller] Failed to parse request JSON, continuing without dynamicVariables",
        err
      );
      dynamicVariables = undefined;
    }

    const mascotApiKey = process.env.MASCOT_BOT_API_KEY;
    const elevenApiKey = process.env.ELEVENLABS_API_KEY;
    const elevenAgentId = process.env.ELEVENLABS_AGENT_ID;

    if (!mascotApiKey) {
      console.error("[get-signed-url-seller] MASCOT_BOT_API_KEY fehlt oder ist leer");
      return NextResponse.json(
        { error: "MASCOT_BOT_API_KEY is missing on the server" },
        { status: 500 }
      );
    }

    if (!elevenApiKey || !elevenAgentId) {
      console.error(
        "[get-signed-url-seller] ELEVENLABS_API_KEY oder ELEVENLABS_AGENT_ID fehlt oder ist leer"
      );
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID are required" },
        { status: 500 }
      );
    }

    const signedUrl = await createSignedUrlFromMascot({
      mascotApiKey,
      elevenApiKey,
      elevenAgentId,
      dynamicVariables,
    });

    // ✅ Frontend erwartet { signedUrl: string }
    return NextResponse.json({ signedUrl });
  } catch (error: unknown) {
    console.error("[get-signed-url-seller] Unerwarteter Fehler", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate signed URL";
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        details: message,
      },
      { status: 500 }
    );
  }
}
