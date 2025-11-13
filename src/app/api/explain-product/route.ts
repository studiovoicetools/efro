import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ExplainRequestBody = {
  handle: string;
  question: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExplainRequestBody;
    const { handle, question } = body;

    if (!handle || !question) {
      return NextResponse.json(
        { ok: false, error: "Missing handle or question" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    // Produktdaten ueber deinen bestehenden Endpoint holen
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      `http://localhost:${process.env.PORT || 3000}`;

    const productRes = await fetch(
      `${baseUrl}/api/shopify-products?handle=${encodeURIComponent(handle)}`,
      { cache: "no-store" }
    );

    if (!productRes.ok) {
      const text = await productRes.text();
      return NextResponse.json(
        {
          ok: false,
          error: "shopify-products returned error",
          status: productRes.status,
          body: text,
        },
        { status: 502 }
      );
    }

    const productJson = await productRes.json();

    if (!productJson.success || !productJson.products?.length) {
      return NextResponse.json(
        { ok: false, error: "No product found for given handle" },
        { status: 404 }
      );
    }

    const p = productJson.products[0];

    const prompt = `
Du bist ein Verkaufsberater in einem Online Shop.
Erklaere dem Kunden das folgende Produkt verstaendlich, freundlich und klar.

Produktname: ${p.title}
Preis: ${p.price}
Verfuegbar: ${p.available ? "ja" : "nein"}
Produkt URL: ${p.url || "keine URL verfuegbar"}

Frage des Kunden:
"${question}"

Bitte antworte in maximal 5 bis 8 Saetzen,
auf Deutsch, ohne Emojis, und klar verstaendlich.
Wenn das Produkt nicht verfuegbar ist, erklaere eine passende Alternative aus der gleichen Kategorie, falls moeglich.
    `.trim();

    const openAIRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        }),
      }
    );

    if (!openAIRes.ok) {
      const text = await openAIRes.text();
      return NextResponse.json(
        {
          ok: false,
          error: "OpenAI request failed",
          status: openAIRes.status,
          body: text,
        },
        { status: 502 }
      );
    }

    const aiData = await openAIRes.json();
    const answer =
      aiData.choices?.[0]?.message?.content ||
      "Ich konnte leider keine passende Antwort generieren.";

    return NextResponse.json({ ok: true, answer }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
