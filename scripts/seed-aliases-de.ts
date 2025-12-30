/* eslint-disable no-console */
import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

type Row = {
  term: string;                 // wird in DB gespeichert (lowercased, getrimmt)
  normalized_term: string;      // normalizeAliasKey(term)
  canonical: string;            // NOT NULL in deiner DB
  type: "category" | "tag" | "brand" | "usage";
  map_to_category_slug?: string | null;
  map_to_tag?: string | null;
  map_to_brand?: string | null;
  shop_domain?: string | null;
  confidence?: number;
  source?: "static" | "ai" | "manual";
  updated_at?: string;
};

function normalizeAliasKey(key: string): string {
  return String(key || "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/gi, "")
    .trim();
}

function uniq<T>(arr: T[]) { return Array.from(new Set(arr)); }

function variants(term: string): string[] {
  const t = String(term || "").trim();
  if (!t) return [];

  const deuml = (s: string) =>
    s.replace(/ä/g,"ae").replace(/ö/g,"oe").replace(/ü/g,"ue").replace(/ß/g,"ss");
  const uml = (s: string) =>
    s.replace(/ae/g,"ä").replace(/oe/g,"ö").replace(/ue/g,"ü");

  const base = [
    t,
    t.toLowerCase(),
    t.replace(/-/g, " "),
    t.replace(/\s+/g, "-"),
    t.replace(/[()]/g, ""),
  ].map((x) => x.trim()).filter(Boolean);

  const out = new Set<string>();
  for (const x of base) {
    out.add(x);
    out.add(deuml(x));
    out.add(uml(x));
    out.add(x.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim());
  }

  return Array.from(out).map((x) => x.trim()).filter((x) => x.length >= 2);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[seed-aliases] missing env SUPABASE_URL / SUPABASE_SERVICE_KEY");
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const fixturePath = "scripts/fixtures/products.demo.supabase.json";
  const raw = JSON.parse(await fs.readFile(fixturePath, "utf-8"));
  const products = Array.isArray(raw) ? raw : raw?.products;
  if (!Array.isArray(products)) {
    console.error("[seed-aliases] fixture has no products[]");
    process.exit(2);
  }

  // Canonical pools (aus Fixture)
  const cats = new Set<string>();
  const tags = new Set<string>();

  for (const p of products) {
    const c = String(p?.category ?? "").trim().toLowerCase();
    if (c) cats.add(c);

    const t = p?.tags;
    if (Array.isArray(t)) {
      for (const x of t) {
        const v = String(x ?? "").trim().toLowerCase();
        if (v.length >= 2) tags.add(v);
      }
    } else {
      const s = String(t ?? "");
      for (const part of s.split(/[;,]| \| /g)) {
        const v = part.trim().toLowerCase();
        if (v.length >= 2) tags.add(v);
      }
    }
  }

  const catList = Array.from(cats);
  const tagList = Array.from(tags);

  console.log("[seed-aliases] canon categories:", catList.length, "tags:", tagList.length);

  const rows: Row[] = [];

  // Seeds: Kategorie-Namen als Aliase auf sich selbst (und Varianten)
  for (const canonical of catList) {
    for (const v of variants(canonical)) {
      const term = v.trim().toLowerCase();
      if (!term) continue;
      rows.push({
        term,
        normalized_term: normalizeAliasKey(term),
        canonical, // NOT NULL
        type: "category",
        map_to_category_slug: canonical,
        map_to_tag: null,
        map_to_brand: null,
        shop_domain: null,
        confidence: 0.75,
        source: "static",
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Seeds: Tag-Namen als Aliase auf sich selbst (und Varianten)
  for (const canonical of tagList) {
    for (const v of variants(canonical)) {
      const term = v.trim().toLowerCase();
      if (!term) continue;
      rows.push({
        term,
        normalized_term: normalizeAliasKey(term),
        canonical, // NOT NULL
        type: "tag",
        map_to_category_slug: null,
        map_to_tag: canonical,
        map_to_brand: null,
        shop_domain: null,
        confidence: 0.70,
        source: "static",
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Dedup im Batch: key = lower(term) (damit "küche" nur 1× im Insert vorkommt)
  const byTerm = new Map<string, Row>();
  for (const r of rows) {
    const k = String(r.term || "").trim().toLowerCase();
    const prev = byTerm.get(k);
    const prevC = Number(prev?.confidence ?? 0);
    const curC = Number(r?.confidence ?? 0);
    if (!prev || curC > prevC) byTerm.set(k, r);
  }
  const deduped = Array.from(byTerm.values());

  console.log("[seed-aliases] rows:", rows.length, "dedup:", deduped.length);

  // Insert SEQUENTIELL:
  // - 23505 (unique) -> skip
  // - PGRST204 (confidence column missing) -> retry ohne confidence
  let inserted = 0;
  let skipped = 0;
  let droppedConfidence = false;

  for (const r of deduped) {
    const payload: any = { ...r };
    if (droppedConfidence) delete payload.confidence;

    const { error } = await supabase.from("aliases_de").insert(payload);

    if (!error) { inserted++; continue; }

    // confidence nicht im schema cache? -> einmalig umschalten und retry
    if (error.code === "PGRST204" && String(error.message || "").includes("confidence")) {
      droppedConfidence = true;
      const payload2: any = { ...r };
      delete payload2.confidence;
      const { error: e2 } = await supabase.from("aliases_de").insert(payload2);
      if (!e2) { inserted++; continue; }
      // wenn jetzt duplicate, dann skip, sonst hart aussteigen
      if (e2.code === "23505") { skipped++; continue; }
      console.error("[seed-aliases] insert failed after dropping confidence:", e2);
      process.exit(1);
    }

    // already exists -> skip
    if (error.code === "23505") { skipped++; continue; }

    // not-null canonical -> sollte nicht passieren; dann ist canonical leer
    console.error("[seed-aliases] insert failed:", error);
    process.exit(1);
  }

  // Count
  const { count, error: countErr } = await supabase
    .from("aliases_de")
    .select("id", { count: "exact", head: true });

  if (countErr) console.error("[seed-aliases] count error:", countErr);
  console.log("[seed-aliases] DONE inserted:", inserted, "skipped:", skipped, "aliases_de count:", count ?? null);
}

main().catch((e) => {
  console.error("[seed-aliases] fatal:", e);
  process.exit(1);
});
