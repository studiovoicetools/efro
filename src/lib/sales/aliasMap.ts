// src/lib/sales/aliasMap.ts

import generatedAliasMapJson from "./generatedAliasMap.json";

// normalizeText wird nicht direkt exportiert, daher verwenden wir eine lokale Implementierung
// die der Logik in sellerBrain.ts entspricht
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Alias-Map: Ordnet unbekannte Kundenbegriffe bekannten Katalog-Keywords zu
 * 
 * Struktur: Record<unknownTerm, canonicalKeywords[]>
 * 
 * Beispiel:
 * {
 *   "fressnapf": ["hunde", "napfset"],
 *   "napf": ["näpfe", "napfset", "hunde"],
 *   "napfset": ["näpfe", "napf", "hunde"]
 * }
 */
export type AliasMap = Record<string, string[]>;

/**
 * Normalisiert einen Alias-Key (unbekannter Begriff) für die Suche in der Alias-Map.
 * 
 * WICHTIG: Diese Funktion muss konsistent mit der Token-Extraktion in sellerBrain sein.
 * - Alles in lowercase
 * - Umlaute bleiben erhalten (ä, ö, ü, ß)
 * - Sonderzeichen (Punkte, Kommas, etc.) werden entfernt
 * - Leerzeichen werden entfernt
 * 
 * @param key Der zu normalisierende Begriff
 * @returns Normalisierter Begriff (klein, trim, Umlaute erhalten, Sonderzeichen entfernt)
 */
export function normalizeAliasKey(key: string): string {
  if (!key) return "";
  
  // Gleiche Normalisierung wie normalizeText, aber OHNE Leerzeichen behalten
  // (da wir einzelne Tokens normalisieren, nicht ganze Texte)
  return key
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]/gi, "") // Alle Sonderzeichen entfernen (inkl. Punkte, Kommas)
    .trim();
}

/**
 * Initialisiert die Alias-Map aus JSON und normalisiert alle Keys und Values.
 * 
 * WICHTIG: Filtert NICHT aggressiv - alle Values werden behalten, auch wenn sie
 * nicht in catalogKeywords vorkommen. Das Scoring entscheidet später, ob es Matches gibt.
 * 
 * @param catalogKeywords Liste von bekannten Katalog-Keywords (für Logging)
 * @returns Normalisierte Alias-Map
 */
export function initializeAliasMap(catalogKeywords: string[]): AliasMap {
  const known = new Set(
    (catalogKeywords || []).map((k) => normalizeAliasKey(k))
  );

  const raw = (generatedAliasMapJson || {}) as Record<string, string[]>;
  const normalized: AliasMap = {};

  for (const [rawKey, rawValues] of Object.entries(raw)) {
    const key = normalizeAliasKey(rawKey);
    
    // Filtere Values: Nur solche, die auch wirklich im Katalog vorkommen
    const values = Array.from(
      new Set(
        (rawValues || [])
          .map((v) => normalizeAliasKey(v))
          .filter((v) => v.length > 0 && known.has(v)) // Nur Katalog-Keywords behalten
      )
    );

    if (!key || values.length === 0) continue;

    normalized[key] = values;
  }

  console.log("[EFRO AliasMapInit]", {
    catalogKeywordsCount: known.size,
    aliasKeys: Object.keys(normalized).slice(0, 20),
    rawAliasKeys: Object.keys(raw).slice(0, 20),
    fressnapfEntry: normalized["fressnapf"] || null,
    rawFressnapfEntry: raw["fressnapf"] || raw["Fressnapf"] || null,
  });

  return normalized;
}
