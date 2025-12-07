// src/lib/sales/modules/utils/textUtils.ts
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
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
