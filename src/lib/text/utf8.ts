// src/lib/text/utf8.ts
const MOJIBAKE_RE = /Ã|Â|â€|â€™|â€œ|â€�|â€“|â€”|â€¦|â‚¬|â„¢|â€\s|�/;

export function looksBroken(s: unknown): boolean {
  return typeof s === "string" && MOJIBAKE_RE.test(s);
}

/**
 * Robust: repariert nur wenn es nach Mojibake aussieht.
 * Wichtig: keine "immer reparieren"-Magie, sonst machst du korrekten Text kaputt.
 */
export function fixUtf8(s: unknown): string {
  const input = typeof s === "string" ? s : "";
  if (!input) return input;
  if (!looksBroken(input)) return input;

  let out = input;

  // 1) Häufige direkte Ersetzungen (schnell + sicher)
  out = out
    .replace(/â‚¬/g, "€")
    .replace(/â¬/g, "€")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€œ/g, "“")
    .replace(/â€�/g, "”")
    .replace(/â€˜/g, "‘")
    .replace(/â€™/g, "’")
    .replace(/â€¦/g, "…")
    .replace(/Â/g, ""); // oft nur "Â " vor € etc.

  // 2) Klassische UTF8->Latin1 Fehl-Decodierung zurückdrehen (Node runtime)
  // nur wenn danach noch Mojibake da ist
  if (looksBroken(out)) {
    try {
      // Buffer ist in nodejs runtime verfügbar; falls nicht, fällt es einfach durch
      const B = (globalThis as unknown as { Buffer?: typeof Buffer }).Buffer;
      if (B) {
        for (let i = 0; i < 2; i++) {
          if (!looksBroken(out)) break;
          const prev = out;
          out = B.from(out, "latin1").toString("utf8");
          if (out === prev) break;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3) Letzter Sicherheitsgurt: deutsche Klassiker (hilft auch bei halb-kaputten Fällen)
  out = out
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã¼/g, "ü")
    .replace(/Ã„/g, "Ä")
    .replace(/Ã–/g, "Ö")
    .replace(/Ãœ/g, "Ü")
    .replace(/ÃŸ/g, "ß");

  return out;
}

export function fixTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .flatMap((t) => String(fixUtf8(t)).split(/[,;]+/g))
      .map((t) => t.trim())
      .filter(Boolean);
  }
  if (typeof tags === "string") {
    return fixUtf8(tags)
      .split(/[,;]+/g)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}
