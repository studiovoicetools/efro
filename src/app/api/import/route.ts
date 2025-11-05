import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

export const runtime = "nodejs";

// Supabase initialisieren
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// OpenAI initialisieren
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  console.log("📦 Import-API wurde aufgerufen!");

  try {
    // Datei empfangen
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Keine Datei empfangen." });
    }

    // CSV-Inhalt lesen und evtl. BOM entfernen
    const text = (await file.text()).replace(/^\uFEFF/, "");

    // CSV parsen → records: Array<Record<string, string>>
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      delimiter: ",",
    }) as Record<string, string>[];

    console.log("🧠 CSV Records Preview:", records.slice(0, 3));

    let inserted = 0;
    const errors: { row: number; message: string }[] = [];

    // Iterator sauber in Array umwandeln → kein TS-Fehler mehr
    for (const [i, r] of Array.from(records.entries())) {
      try {
        const row = r as Record<string, any>;

        // Pflichtfelder prüfen
        if (!row.sku || !row.title) {
          errors.push({
            row: i + 1,
            message: "Pflichtfelder fehlen (sku/title)",
          });
          continue;
        }

        // Produktdaten strukturieren
        const productData = {
          sku: row.sku,
          title: row.title,
          description: row.description || "",
          price: row.price ? parseFloat(row.price) : 0,
          compare_at_price: row.compare_at_price
            ? parseFloat(row.compare_at_price)
            : null,
          tags: row.tags || "",
          category: row.category || "",
          inventory: row.inventory ? parseInt(row.inventory) : 0,
          image_url: row.image_url || "",
          product_url: row.product_url || "",
          cross_sell_skus: row.cross_sell_skus || "",
          upsell_skus: row.upsell_skus || "",
          language: row.language || "de",
          color: row.color || "",
          size: row.size || "",
          variant_id: row.variant_id || "",
          available:
            typeof row.available === "string"
              ? row.available.toLowerCase().trim() === "true"
              : !!row.available,
        };

        // Produkt in Supabase speichern (Upsert)
        const { error: upsertErr } = await supabase
          .from("products")
          .upsert(productData, { onConflict: "sku" });

        if (upsertErr) throw upsertErr;

        // Embedding erzeugen
        const inputText = `${row.title}\n${row.description}\n${row.tags}`;
        const embeddingResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: inputText,
        });

        const vector = embeddingResp.data[0].embedding;

        // Embedding speichern
        const { error: embedErr } = await supabase
          .from("product_embeddings")
          .upsert({ sku: row.sku, embedding: vector });

        if (embedErr) throw embedErr;

        inserted++;
      } catch (err: any) {
        console.error("❌ Zeilenfehler:", err.message);
        errors.push({ row: i + 1, message: err.message });
      }
    }

    console.log(
      `✅ Import abgeschlossen. Erfolgreich: ${inserted}, Fehler: ${errors.length}`
    );

    return NextResponse.json({
      ok: errors.length === 0,
      inserted,
      skipped: errors.length,
      errors,
    });
  } catch (err: any) {
    console.error("❌ Import-Fehler:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}

