import fs from "node:fs";
import path from "node:path";

export type FaqTopic = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
};

export type FaqDoc = {
  version: number;
  language: "de" | "en";
  topics: FaqTopic[];
};
export const DEFAULT_FAQ_THRESHOLD = 0.10;


function norm(s: string): string {
  return String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function loadFaqDoc(fixturePath = "scripts/fixtures/shop.faq.json"): FaqDoc | null {
  try {
    const abs = path.resolve(process.cwd(), fixturePath);
    const raw = fs.readFileSync(abs, "utf8");
    return JSON.parse(raw) as FaqDoc;
  } catch {
    return null;
  }
}

export function matchFaq(text: string, doc: FaqDoc | null): { topic: FaqTopic; score: number } | null {
  if (!doc) return null;
  const t = norm(text);
  if (!t) return null;

  let best: { topic: FaqTopic; score: number } | null = null;

  for (const topic of doc.topics || []) {
    const kws = (topic.keywords || []).map(norm).filter(Boolean);
    let hit = 0;

    for (const kw of kws) {
      if (kw && t.includes(kw)) hit += 1;
    }

    const score = hit / Math.max(3, Math.min(10, kws.length || 1));
    if (hit > 0 && (!best || score > best.score)) best = { topic, score };
  }

  return best;
}

export function matchFaq(text: string, doc: FaqDoc | null): { topic: FaqTopic; score: number } | null {
  if (!doc) return null;
  const t = norm(text);
  if (!t) return null;

  let best: { topic: FaqTopic; score: number } | null = null;

  for (const topic of doc.topics || []) {
    const kws = (topic.keywords || []).map(norm).filter(Boolean);
    let hit = 0;

    for (const kw of kws) {
      if (kw && t.includes(kw)) hit += 1;
    }

    const score = hit / Math.max(3, Math.min(10, kws.length || 1));
    if (hit > 0 && (!best || score > best.score)) best = { topic, score };
  }

  return best;
}
