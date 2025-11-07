export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";


export async function POST(req: Request) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Supabase-Variablen fehlen!");
      return NextResponse.json(
        { ok: false, error: "Supabase-Konfiguration fehlt." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Keine Datei erhalten." });

    const text = (await file.text()).replace(/^\uFEFF/, "");
    const records = parse(text, { columns: true, skip_empty_lines: true }) as any[];

    let inserted = 0;
    const errors: { row: number; message: string }[] = [];

    for (const [i, r] of records.entries()) {
      try {
        if (!r.sku || !r.title) {
          errors.push({ row: i + 1, message: "Pflichtfelder fehlen (sku/title)" });
          continue;
        }

        const productData = {
          sku: r.sku,
          title: r.title,
          description: r.description || "",
          price: parseFloat(r.price || 0),
          category: r.category || "",
          tags: r.tags || "",
          image_url: r.image_url || "",
        };

        const { error } = await supabase.from("products").upsert(productData, { onConflict: "sku" });
        if (error) throw error;

        const embeddingResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: `${r.title}\n${r.description}\n${r.tags}`,
        });

        const vector = embeddingResp.data[0].embedding;
        await supabase.from("product_embeddings").upsert({ sku: r.sku, embedding: vector });

        inserted++;
      } catch (err: any) {
        errors.push({ row: i + 1, message: err.message });
      }
    }

    return NextResponse.json({ ok: true, inserted, skipped: errors.length, errors });
  } catch (err: any) {
    console.error("❌ Import-Fehler:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}

