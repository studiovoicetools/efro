// src/lib/sales/modules/utils/textUtils.ts

function looksLikeMojibake(s: string): boolean {
  // typische UTF8->Latin1 Fehl-Decodierung (Ã¼, Ã¶, Ã¤, â€“, â€™, Â etc.)
  return /Ã|Â|â€|â€™|â€œ|â€|â€“|â€¦/.test(s);
}

function fixMojibakeUtf8(s: string): string {
  if (!s) return s;
  if (!looksLikeMojibake(s)) return s;

  try {
    // Node / Server
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B: any = (globalThis as any).Buffer;
    if (typeof B !== "undefined") {
      const out = B.from(s, "latin1").toString("utf8");
      return out || s;
    }
  } catch {}

  try {
    // Browser / Edge
    if (typeof TextDecoder !== "undefined") {
      const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
      const out = new TextDecoder("utf-8").decode(bytes);
      return out || s;
    }
  } catch {}

  return s;
}


export function fixMojibakeForDisplay(input: string): string {
  return fixMojibakeUtf8(input || "").replace(/\uFFFD/g, "");
}







export function normalizeText(input: string): string {
  const fixed = fixMojibakeUtf8(input || "")
    // häufige Euro-Mojibake-Fälle (dein Beispiel)
    .replace(/Ã¢âÂ¬/g, "€")
    .replace(/â\uFFFD¬/g, "€") // "â\uFFFD¬" = â + U+FFFD + ¬
    .replace(/â‚¬/g, "€")
    // häufiges "Â" als Artefakt (z. B. "10Â €")
    .replace(/Â/g, "");

  return fixed
    .toLowerCase()
    // WICHTIG: ursprüngliche Logik – nur mit € ergänzt
    .replace(/[^a-z0-9äöüß€\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalize(text: string): string {
  return normalizeText(text);
}

export function getDescriptionSnippet(
  description?: string | null,
  maxLength: number = 280
): string | null {
  if (!description) return null;
  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength) + "…";
}

export function extractStepsFromDescription(description: string): string[] {
  if (!description || description.trim().length < 30) return [];
  const steps: string[] = [];
  const lines = description.split(/\n+/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const stepPattern = /^([A-ZÄÖÜ][a-zäöüß\s]+):\s*(.+)$/;
    const match = trimmed.match(stepPattern);
    if (match) {
      const stepTitle = match[1].trim();
      const stepDescription = match[2].trim();
      if (stepDescription.length > 10) {
        steps.push(`${stepTitle}: ${stepDescription}`);
      } else {
        steps.push(stepTitle);
      }
    } else if (trimmed.length > 20 && /^(reinigen|auftragen)/i.test(trimmed)) {
      steps.push(trimmed);
    }
  }

  if (steps.length === 0 && description.length > 100) {
    const paragraphs = description
      .split(/\n\s*\n/)
      .filter((p) => p.trim().length > 20);
    if (paragraphs.length > 0) return paragraphs.slice(0, 7);
  }

  return steps;
}

/**
 * EFRO Modularization Phase 3: collectMatches ausgelagert
 * 
 * Sammelt Matches aus einem Text basierend auf einem Dictionary von Keywords.
 */
export function collectMatches(
  text: string,
  dict: Record<string, string[]>
): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const [key, patterns] of Object.entries(dict)) {
    for (const p of patterns) {
      if (t.includes(p.toLowerCase())) {
        hits.push(key);
        break;
      }
    }
  }
  return Array.from(new Set(hits));
}

/**
 * Normalisiert rohen User-Input für die weitere Verarbeitung in EFRO.
 * - wandelt türkisches "ı" in "i" um
 * - normalisiert Unicode (NFKC)
 * - entfernt Steuerzeichen
 * - reduziert mehrfachen Whitespace auf ein einzelnes Leerzeichen
 * - trimmt führende und nachfolgende Leerzeichen
 * - wandelt alles in Kleinbuchstaben um
 */
export function normalizeUserInput(raw: string | null | undefined): string {
  if (!raw) return "";

  // Unicode-Normalisierung (z. B. kombinierte Zeichen)
  let text = raw.normalize("NFKC");

  // Türkisches "ı" in "i" umwandeln
  text = text.replace(/\u0131/g, "i");

  // Steuerzeichen entfernen
  text = text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

  // Mehrfach-Whitespace auf ein einzelnes Leerzeichen reduzieren
  text = text.replace(/\s+/g, " ").trim();

  // In Kleinbuchstaben umwandeln
  text = text.toLowerCase();

  return text;
}
