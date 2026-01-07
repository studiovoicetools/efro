// src/lib/text/encoding.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

function isPlainObject(v: any): v is Record<string, any> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function mojibakeScore(s: string): number {
  // je höher, desto "verdächtiger"
  const hits = s.match(/[ÃÂ]|â€|â¬|\u001a|\u001c/g);
  return hits ? hits.length : 0;
}

/**
 * Repariert typische UTF-8/Latin1/CP1252 Mojibake-Fälle.
 * Ziel: API-Ausgaben sollen keine "Ã", "â€", "�", "\u001a", "\u001c" enthalten.
 */
export function fixEncodingString(input: string): string {
  let s = String(input ?? "");

  if (!s) return "";

  // Häufige harte Artefakte zuerst (bei dir im Guard gefunden)
  s = s.replace(/�\u001a�/g, "€"); // typischer "Euro kaputt"
  s = s.replace(/�\u001c/g, "–");  // typischer "Dash kaputt"

  // Control chars raus (außer \n \r \t)
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  // Wenn es wie Mojibake aussieht: versuche latin1->utf8 Reparatur (Node)
  const beforeScore = mojibakeScore(s);
  if (beforeScore > 0 && typeof Buffer !== "undefined") {
    try {
      const repaired = Buffer.from(s, "latin1").toString("utf8");
      if (mojibakeScore(repaired) < beforeScore) s = repaired;
    } catch {
      // ignore
    }
  }

  // Klassiker: deutsche Umlaute & ß
  s = s
    .replace(/Ã¤/g, "ä")
    .replace(/Ã„/g, "Ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã–/g, "Ö")
    .replace(/Ã¼/g, "ü")
    .replace(/Ãœ/g, "Ü")
    .replace(/ÃŸ/g, "ß");

  // Euro / Quotes / Dashes (häufige CP1252->UTF8 Mojibake Sequenzen)
  s = s
    .replace(/â‚¬/g, "€")
    .replace(/â¬/g, "€")
    .replace(/Â€/g, "€")
    .replace(/â€œ/g, "“")
    .replace(/â€�/g, "”")
    .replace(/â€ž/g, "„")
    .replace(/â€˜/g, "‘")
    .replace(/â€™/g, "’")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¦/g, "…");

  // "Â " vor Leerzeichen, Gradzeichen etc.
  s = s.replace(/Â\s/g, " ").replace(/Â°/g, "°");

  // Letzter Schritt: übrig gebliebenes Replacement-Char entfernen
  // (Wenn nach Reparatur noch "�" drin ist, ist es ohnehin nicht mehr recoverbar)
  s = s.replace(/�/g, "");

  return s;
}

/** String-Cleaner für UI/API */
export function cleanText(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s0 = typeof v === "string" ? v : String(v);
  const s1 = fixEncodingString(s0);
  return s1.replace(/\s+/g, " ").trim();
}

/** Deep-Fix: repariert ALLE Strings im Objekt/Array */
export function fixEncodingDeep<T = any>(value: T): T {
  if (typeof value === "string") return fixEncodingString(value) as any;
  if (Array.isArray(value)) return value.map((x) => fixEncodingDeep(x)) as any;
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = fixEncodingDeep(v);
    return out as any;
  }
  return value;
}

/** Deep-Sanitize: cleanText auf alle Strings (trim + whitespace + encoding) */
export function sanitizeDeep<T = any>(value: T): T {
  if (typeof value === "string") return cleanText(value) as any;
  if (Array.isArray(value)) return value.map((x) => sanitizeDeep(x)) as any;
  if (isPlainObject(value)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDeep(v);
    return out as any;
  }
  return value;
}

/** Tags normalisieren: Array | CSV | Semikolon | Pipe */
export function normalizeTags(tags: unknown): string[] {
  const parts: string[] = [];

  const pushSplit = (s: string) => {
    const cleaned = cleanText(s);
    if (!cleaned) return;
    // Shopify oft CSV; bei dir auch ";" im Spiel
    cleaned
      .split(/[;,|]/g)
      .map((x) => cleanText(x))
      .filter(Boolean)
      .forEach((x) => parts.push(x));
  };

  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (typeof t === "string") pushSplit(t);
      else if (t != null) pushSplit(String(t));
    }
  } else if (typeof tags === "string") {
    pushSplit(tags);
  } else if (tags != null) {
    pushSplit(String(tags));
  }

  // dedupe (case-insensitive)
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of parts) {
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
