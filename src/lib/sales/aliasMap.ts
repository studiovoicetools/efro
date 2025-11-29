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
 *   "napfset": ["näpfe", "napf", "hunde"],
 *   "parfum": ["perfume"],      // Language-Alias: generischer Sprach-Alias für alle Shops
 *   "parfüm": ["perfume"]       // Language-Alias: parfum/parfüm -> perfume
 * }
 * 
 * Language-Aliase (z. B. "parfum" -> "perfume") sind generische Sprach-Aliase,
 * die für alle Shops gelten und nicht shop-spezifisch sind.
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
 * Generische Sprach-Aliase, die für alle Shops gelten.
 * Werden später gegen catalogKeywords gefiltert, damit nur vorhandene Tokens übrig bleiben.
 * 
 * Beispiel: "parfum" / "parfüm" -> "perfume" ist ein generischer Sprach-Alias,
 * der für alle Shops gilt und nicht shop-spezifisch ist.
 */
const LANGUAGE_ALIAS_SEEDS: Record<string, string[]> = {
  parfum: ["perfume"],
  "parfüm": ["perfume"],
  parfume: ["perfume"],
  perfüm: ["perfume"],
};

/**
 * Liste von Language-Alias-Keys, die IMMER erhalten bleiben sollen
 * (generische Sprach-Aliase, die für alle Shops gelten)
 */
const LANGUAGE_ALIAS_KEYS = new Set([
  "parfum", "parfüm", "perfüm", "parfume", "perfume",
  "fressnapf", "napf", "napfset", // Bestehende manuelle Aliase
]);

/**
 * Initialisiert die Alias-Map aus JSON und normalisiert alle Keys und Values.
 * 
 * WICHTIG: 
 * - Language-Aliase (z. B. "parfum" -> "perfume") bleiben IMMER erhalten, auch wenn "perfume" nicht in catalogKeywords ist.
 * - Andere Values werden nur behalten, wenn sie in catalogKeywords vorkommen.
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

  // 1. Aus generatedAliasMap.json (bestehende Logik beibehalten)
  for (const [rawKey, rawValues] of Object.entries(raw)) {
    // Überspringe Metadaten-Keys
    if (rawKey.startsWith("_")) continue;
    
    const key = normalizeAliasKey(rawKey);
    if (!key) continue;
    
    const isLanguageAlias = LANGUAGE_ALIAS_KEYS.has(key);
    
    // Filtere Values: 
    // - Bei Language-Aliases: Alle Values behalten (auch wenn nicht in catalogKeywords)
    // - Bei anderen: Nur solche, die im Katalog vorkommen
    const values = Array.from(
      new Set(
        (rawValues || [])
          .map((v) => normalizeAliasKey(v))
          .filter((v) => {
            if (v.length === 0) return false;
            // Language-Aliase: Immer behalten
            if (isLanguageAlias) return true;
            // Andere: Nur wenn im Katalog vorhanden
            return known.has(v);
          })
      )
    );

    // Language-Aliase: Immer behalten, auch wenn values leer ist (wird später gefüllt)
    if (isLanguageAlias && values.length === 0) {
      // Falls leer, versuche trotzdem die rawValues zu behalten (für Debugging)
      const rawNormalized = (rawValues || []).map((v) => normalizeAliasKey(v)).filter((v) => v.length > 0);
      if (rawNormalized.length > 0) {
        normalized[key] = rawNormalized;
      }
      continue;
    }

    if (values.length === 0) continue;

    normalized[key] = values;
  }

  // 2. Sprach-Aliase ergänzen (OHNE Filterung gegen catalogKeywords)
  // Grund: Sprach-Aliase sollen AUCH funktionieren, wenn der Katalog das Keyword
  // nicht explizit als eigenes Token enthält, aber z. B. im Titel oder in der Beschreibung.
  for (const [rawKey, rawValues] of Object.entries(LANGUAGE_ALIAS_SEEDS)) {
    const key = normalizeAliasKey(rawKey);
    if (!key) continue;
    
    const normalizedValues = Array.from(
      new Set(
        (rawValues || [])
          .map((v) => normalizeAliasKey(v))
          .filter((v) => v.length > 0) // Nur leere Werte entfernen, KEINE catalogKeywords-Filterung
      )
    );

    if (normalizedValues.length > 0) {
      // Merge mit bestehenden Einträgen (falls vorhanden)
      const existing = normalized[key] || [];
      const merged = Array.from(new Set([...existing, ...normalizedValues]));
      normalized[key] = merged;
    }
  }

  // Debug-Log (nur im Dev-Mode)
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const parfumKey = normalizeAliasKey("parfum");
    const parfümKey = normalizeAliasKey("parfüm");
    console.log("[EFRO AliasMapInit]", {
      catalogKeywordsCount: known.size,
      aliasKeys: Object.keys(normalized).slice(0, 20),
      aliasKeysCount: Object.keys(normalized).length,
      rawAliasKeys: Object.keys(raw).slice(0, 20),
      fressnapfEntry: normalized["fressnapf"] || null,
      rawFressnapfEntry: raw["fressnapf"] || raw["Fressnapf"] || null,
      parfumEntry: normalized[parfumKey] || null,
      parfümEntry: normalized[parfümKey] || null,
      hasPerfumeInKnown: known.has("perfume"),
      parfumFromSeeds: LANGUAGE_ALIAS_SEEDS["parfum"] || null,
      exampleKnown: Array.from(known).slice(0, 20).filter(k => k.includes("perf") || k.includes("duft")),
    });
  }

  return normalized;
}
