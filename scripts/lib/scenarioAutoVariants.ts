// scripts/lib/scenarioAutoVariants.ts

import type { SellerBrainContext } from "../../src/lib/sales/sellerBrain";

export type ScenarioSeed = {
  id: string;
  title: string;
  query: string;
  note?: string;
  context?: any;

  // Optional: Felder, die ScenarioTest kennt (damit Smoke-Tests sie löschen dürfen)
  expected?: unknown;
  variants?: unknown;
  variantQueries?: unknown;
};

function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const key = normalizeSpaces(s);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function safeCandidates(q: string): string[] {
  const t = q.trim();
  const out: string[] = [];

  // Satzzeichen-Varianten
  if (!/[.?!]$/.test(t)) out.push(t + "?");
  out.push(t.replace(/[.]+$/, "?"));
  out.push(t.replace(/[?]+$/, "."));
  out.push(t + "!");
  out.push(t.replace(/[!]+$/, "."));

  // sehr harmlose Prefix/Suffix (Smoke = ohne expected)
  out.push("Bitte: " + t);
  out.push("Kurze Frage: " + t);
  out.push("Hey, " + t);
  out.push(t + " bitte");
  out.push(t + " danke");
  out.push(t + " ??");

  // Case-Noise (für Smoke ok)
  out.push(t.toLowerCase());

  // niemals identisch
  const filtered = out.map(normalizeSpaces).filter((x) => x !== normalizeSpaces(t));
  return uniq(filtered);
}

/**
 * Erhöht die Gesamtanzahl deterministisch durch zusätzliche "SMOKE"-Tests.
 * Diese Tests haben KEIN expected => sie prüfen nur: SellerBrain läuft durch.
 */
export function addSmokeTestsToReachTarget<T extends ScenarioSeed>(
  tests: T[],
  targetTotal: number,
  opts?: { seed?: number }
): T[] {
  const seed = opts?.seed ?? 1;

  if (!Number.isFinite(targetTotal) || targetTotal <= tests.length) {
    return tests;
  }

  const base = tests.map((t) => ({ ...t })) as T[];

  // Guard: wenn base leer ist, kann kein Smoke erzeugt werden
  if (base.length === 0) {
    throw new Error(
      `[EFRO SMOKE] Cannot generate smoke tests: base tests array is empty.`
    );
  }

  const used = new Set<string>();
  for (const t of base) used.add(normalizeSpaces(t.query));

  const rng = mulberry32(hashString("EFRO_SMOKE") + seed);

  // Templates/Tokenpools (deterministisch, aber "menschlicher" als nur Nummern)
  const prefixes = [
    "Hey,",
    "Hi,",
    "Kurze Frage:",
    "Kannst du mir helfen:",
    "Ich suche",
    "Ich brauche",
    "Bitte zeig mir",
    "Hast du Empfehlungen für",
    "Was empfiehlst du für",
  ];

  const intents = [
    "günstig",
    "Preis-Leistung",
    "Premium",
    "für Anfänger",
    "für Fortgeschrittene",
    "als Geschenk",
    "für Alltag",
    "für Reisen",
    "für Büro",
    "für Zuhause",
  ];

  const constraints = [
    "unter 50 €",
    "unter 100 €",
    "unter 200 €",
    "bis 300 €",
    "maximal 400 €",
    "so günstig wie möglich",
    "nicht zu teuer",
    "mit gutem Preis",
  ];

  const suffixes = [
    "Welche Optionen gibt es?",
    "Was passt am besten?",
    "Zeig mir bitte ein paar.",
    "Was würdest du nehmen?",
    "Ich will schnell entscheiden.",
    "Bitte kurz und konkret.",
  ];

  function pick<TT>(arr: TT[]): TT {
    return arr[Math.floor(rng() * arr.length)];
  }

  function maybeTypo(s: string): string {
    // seltene kleine Tippfehler › mehr Varianz, deterministisch
    if (s.length < 10) return s;
    if (rng() < 0.85) return s;
    const i = Math.floor(rng() * (s.length - 2)) + 1;
    return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);
  }

  function makeSmokeQuery(baseQuery: string, n: number): string {
    const q = normalizeSpaces(baseQuery).replace(/[.?!]+$/, "");

    // Mischvarianten aus "real wirkenden" Bausteinen
    let out =
      rng() < 0.5
        ? `${pick(prefixes)} ${q}`
        : `${pick(prefixes)} ${q} ${pick(intents)}`;

    if (rng() < 0.65) out += `, ${pick(constraints)}`;
    if (rng() < 0.55) out += ` — ${pick(suffixes)}`;

    out = maybeTypo(out);

    // WICHTIG: garantierte Uniqueness, ohne den Satz total zu zerstören
    // (SellerBrain darf das ruhig als "Noise" sehen – Smoke hat kein expected)
    out += ` [smoke-${n}]`;

    // Abschlusszeichen
    if (!/[.?!]$/.test(out)) out += rng() < 0.7 ? "?" : ".";
    return out;
  }

  const out: T[] = [...base];
  let smokeIndex = 1;

  // Versuche solange, bis target erreicht ist (mit harter Sicherheitsgrenze)
  // Damit niemals stillschweigend "3703/3703" rauskommt.
  const maxTries = Math.max(50_000, targetTotal * 50);
  let tries = 0;

  while (out.length < targetTotal) {
    tries++;
    if (tries > maxTries) {
      throw new Error(
        `[EFRO SMOKE] Could not reach targetTotal=${targetTotal}. ` +
          `Got=${out.length}. used=${used.size}. tries=${tries}. ` +
          `Increase maxTries or adjust generator.`
      );
    }

    const t = base[Math.floor(rng() * base.length)];
    const candidate = makeSmokeQuery(t.query, smokeIndex);
    const key = normalizeSpaces(candidate);

    if (used.has(key)) continue;
    used.add(key);

    out.push({
      id: `${t.id}__sm${smokeIndex}`,
      title: `${t.title} (SMOKE ${smokeIndex})`,
      query: candidate,
      note: "auto-smoke",
    } as T);

    smokeIndex++;
  }

  if (out.length < targetTotal) {
    console.warn("[EFRO Smoke] WARNING: Could not reach targetTotal", {
      reached: out.length,
      targetTotal,
      base: base.length,
      seed,
    });
  }

  return out;
}
