import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import OpenAI from "openai";

// Supabase-Client initialisieren
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export const runtime = "nodejs";

export async function POST(req: Request) {
  console.log("📦 Import-API wurde aufgerufen!");

  try {
    // Datei auslesen
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Keine Datei empfangen." });
    }

    // Datei lesen
    const text = await file.text();
    const textWithoutBOM = text.replace(/^\uFEFF/, ""); // BOM entfernen

    // CSV korrekt parsen (Komma-getrennt, Header aktiv)
    const records = parse(textWithoutBOM, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      delimiter: ",",
    });

    console.log("🧾 CSV Records Preview:", records.slice(0, 3));

    let inserted = 0;
    const errors: any[] = [];

    for (const [i, r] of records.entries()) {
      try {
        // Pflichtfelder prüfen
        if (!r.sku || !r.title) {
          errors.push({ row: i + 1, message: "Pflichtfelder fehlen (sku/title)" });
          continue;
        }

        // 🧩 Alle Felder vorbereiten (inkl. neuer Spalten)
        const productData = {
          sku: r.sku,
          title: r.title,
          description: r.description || "",
          price: r.price ? parseFloat(r.price) : 0,
          compare_at_price: r.compare_at_price ? parseFloat(r.compare_at_price) : null,
          tags: r.tags || "",
          category: r.category || "",
          inventory: r.inventory ? parseInt(r.inventory) : 0,
          image_url: r.image_url || "",
          product_url: r.product_url || "",
          cross_sell_skus: r.cross_sell_skus || "",
          upsell_skus: r.upsell_skus || "",
          language: r.language || "de",
          color: r.color || "",
          size: r.size || "",
          variant_id: r.variant_id || "",
          available:
            typeof r.available === "string"
              ? r.available.toLowerCase().trim() === "true"
              : !!r.available,
        };

        // 🧠 Produkt einfügen oder aktualisieren (Upsert)
        const { error: upsertErr } = await supabase
          .from("products")
          .upsert(productData, { onConflict: "sku" });

        if (upsertErr) throw upsertErr;

        // 🧬 Embedding erzeugen (Titel + Beschreibung + Tags)
        const inputText = `${r.title}\n${r.description}\n${r.tags}`;
        const embeddingResp = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: inputText,
        });

        const vector = embeddingResp.data[0].embedding;

        // 🧠 Embedding in Supabase speichern
        const { error: embedErr } = await supabase
          .from("product_embeddings")
          .upsert({ sku: r.sku, embedding: vector });

        if (embedErr) throw embedErr;

        inserted++;
      } catch (err: any) {
        console.error("Zeilenfehler:", err.message);
        errors.push({ row: i + 1, message: err.message });
      }
    }

    console.log(`✅ Import abgeschlossen. Erfolgreich: ${inserted}, Fehler: ${errors.length}`);

    return NextResponse.json({
      ok: errors.length === 0,
      inserted,
      skipped: errors.length,
      errors,
    });
  } catch (err: any) {
    console.error("Import-Fehler:", err);
    return NextResponse.json({ ok: false, error: err.message });
  }
}
