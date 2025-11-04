import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { query, language = "de" } = await req.json();
    if (!query) {
      return NextResponse.json({ ok: false, error: "Fehlende Query" });
    }

    console.log("🔍 Suche gestartet:", query);

    // 1️⃣ Eingabetext in Embedding umwandeln
    const embed = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const queryVector = embed.data[0].embedding;

    // 2️⃣ Ähnlichste Produkte suchen (Supabase Vektor-Suche)
    const { data, error } = await supabase.rpc("match_products", {
      query_embedding: queryVector,
      match_count: 5, // top 5 Produkte
      filter_lang: language,
    });

    if (error) throw error;

    console.log(`✅ ${data?.length || 0} Produkte gefunden.`);
    return NextResponse.json({ ok: true, results: data });
  } catch (err: any) {
    console.error("Fehler in /api/query:", err.message);
    return NextResponse.json({ ok: false, error: err.message });
  }
}
