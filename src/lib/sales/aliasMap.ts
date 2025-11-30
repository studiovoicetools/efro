// src/lib/sales/aliasMap.ts

import baseAliasesJson from "./aliases.de.base.json";
import dynamicAliasesJson from "./aliases.de.dynamic.json";
import generatedAliasMapJson from "./generatedAliasMap.json";

// TypeScript-Typen für JSON-Import
type BaseAliasesJson = {
  _comment?: string;
  _version?: string;
  aliases: AliasEntry[];
};

type DynamicAliasesJson = {
  _comment?: string;
  _version?: string;
  aliases: AliasEntry[];
};

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
 * AliasEntry: Strukturierte Alias-Definition
 * 
 * Jeder Alias hat einen Term (z. B. "fressnapf"), einen normalisierten Term,
 * einen Typ (brand, category, usage, tag), optionale Mapping-Felder und Metadaten.
 */
export type AliasEntry = {
  term: string;
  normalizedTerm: string;
  type: "brand" | "category" | "usage" | "tag";
  mapToCategorySlug?: string;
  mapToTag?: string;
  mapToBrand?: string;
  confidence: number;
  source: "static" | "ai" | "manual";
};

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
 * 
 * @deprecated Diese Struktur wird für Rückwärtskompatibilität beibehalten.
 * Verwende stattdessen AliasEntry[] und convertAliasEntriesToMap().
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
 * Lädt Alias-Einträge aus Supabase (falls konfiguriert) oder aus JSON-Dateien.
 * 
 * @param language Sprachcode (z. B. "de")
 * @param shopDomain Optional: Shop-Domain für shop-spezifische Aliase
 * @returns Array von AliasEntry-Objekten
 */
export async function loadAliasEntriesFromSupabase(
  language: "de" = "de",
  shopDomain?: string
): Promise<AliasEntry[]> {
  try {
    const { getEfroSupabaseServerClient } = await import("@/lib/efro/supabaseServer");
    const supabase = getEfroSupabaseServerClient();
    
    if (!supabase) {
      console.log("[EFRO AliasMap] Supabase not configured, skipping database load");
      return [];
    }
    
    // Lade Aliase aus Supabase
    let query = supabase.from("aliases_de").select("*");
    
    // Filter: shop_domain = shopDomain ODER shop_domain IS NULL (globale Aliase)
    if (shopDomain) {
      query = query.or(`shop_domain.eq.${shopDomain},shop_domain.is.null`);
    } else {
      query = query.is("shop_domain", null);
    }
    
    const { data, error } = await query.order("term", { ascending: true });
    
    if (error) {
      console.error("[EFRO AliasMap] Supabase error loading aliases", error);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Konvertiere Supabase-Daten zu AliasEntry[]
    const entries: AliasEntry[] = data.map((row: any) => ({
      term: row.term || "",
      normalizedTerm: row.normalized_term || normalizeAliasKey(row.term || ""),
      type: row.type || "tag",
      mapToCategorySlug: row.map_to_category_slug || undefined,
      mapToTag: row.map_to_tag || undefined,
      mapToBrand: row.map_to_brand || undefined,
      confidence: row.confidence || 0.8,
      source: (row.source || "ai") as "static" | "ai" | "manual",
    }));
    
    console.log("[EFRO AliasMap] Loaded aliases from Supabase", {
      count: entries.length,
      shopDomain: shopDomain || "global",
    });
    
    return entries;
  } catch (err) {
    console.error("[EFRO AliasMap] Error loading aliases from Supabase", err);
    return [];
  }
}

/**
 * Lädt Alias-Einträge aus statischen und dynamischen Quellen.
 * 
 * WICHTIG: Diese Funktion lädt bei jedem Start beide Quellen (statisch + dynamisch).
 * Dynamische Aliase aus Supabase werden optional geladen, falls konfiguriert.
 * 
 * @param language Sprachcode (z. B. "de")
 * @param shopDomain Optional: Shop-Domain für shop-spezifische Aliase aus Supabase
 * @returns Array von AliasEntry-Objekten
 */
export function loadAliasEntries(language: "de" = "de", shopDomain?: string): AliasEntry[] {
  const entries: AliasEntry[] = [];

  // 1. Statische Aliase aus aliases.de.base.json
  if (baseAliasesJson && typeof baseAliasesJson === "object" && "aliases" in baseAliasesJson) {
    const baseAliases = (baseAliasesJson as BaseAliasesJson).aliases || [];
    for (const entry of baseAliases) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "term" in entry &&
        "normalizedTerm" in entry &&
        "type" in entry &&
        "confidence" in entry &&
        "source" in entry
      ) {
        const alias = entry as AliasEntry;
        // Validiere, dass alle erforderlichen Felder vorhanden sind
        if (
          typeof alias.term === "string" &&
          typeof alias.normalizedTerm === "string" &&
          typeof alias.type === "string" &&
          typeof alias.confidence === "number" &&
          typeof alias.source === "string"
        ) {
          entries.push(alias);
        }
      }
    }
  }

  // 2. Dynamische Aliase aus aliases.de.dynamic.json
  if (dynamicAliasesJson && typeof dynamicAliasesJson === "object" && "aliases" in dynamicAliasesJson) {
    const dynamicAliases = (dynamicAliasesJson as DynamicAliasesJson).aliases || [];
    for (const entry of dynamicAliases) {
      if (
        typeof entry === "object" &&
        entry !== null &&
        "term" in entry &&
        "normalizedTerm" in entry &&
        "type" in entry &&
        "confidence" in entry &&
        "source" in entry
      ) {
        const alias = entry as AliasEntry;
        // Validiere, dass alle erforderlichen Felder vorhanden sind
        if (
          typeof alias.term === "string" &&
          typeof alias.normalizedTerm === "string" &&
          typeof alias.type === "string" &&
          typeof alias.confidence === "number" &&
          typeof alias.source === "string"
        ) {
          entries.push(alias);
        }
      }
    }
  }
  
  // 3. Dynamische Aliase aus Supabase (optional, asynchron geladen)
  // HINWEIS: Diese werden beim ersten Aufruf von initializeAliasMap geladen
  // und dann in den Cache übernommen. Für synchrone loadAliasEntries() werden
  // nur JSON-Dateien geladen. Supabase-Aliase werden separat geladen, wenn nötig.

  // 3. Rückwärtskompatibilität: Migriere bestehende generatedAliasMap.json
  // (wird später entfernt, wenn alle Aliase migriert sind)
  const raw = (generatedAliasMapJson || {}) as Record<string, unknown>;
  for (const [rawKey, rawValues] of Object.entries(raw)) {
    // Überspringe Metadaten-Keys
    if (rawKey.startsWith("_")) continue;

    const key = normalizeAliasKey(rawKey);
    if (!key) continue;

    const rawArray = Array.isArray(rawValues) ? rawValues : [];
    if (rawArray.length === 0) continue;

    // Prüfe, ob dieser Alias bereits in entries vorhanden ist
    const existingIndex = entries.findIndex((e) => normalizeAliasKey(e.term) === key);
    if (existingIndex >= 0) {
      // Überspringe, da bereits aus base/dynamic geladen
      continue;
    }

    // Konvertiere alte Struktur zu AliasEntry
    // Versuche, den Typ aus dem ersten Value zu bestimmen
    const firstValue = rawArray[0];
    if (typeof firstValue === "string") {
      const normalizedValue = normalizeAliasKey(firstValue);
      
      // Bestimme Typ basierend auf dem Value
      let type: "brand" | "category" | "usage" | "tag" = "tag";
      let mapToCategorySlug: string | undefined;
      let mapToTag: string | undefined;
      let mapToBrand: string | undefined;

      if (normalizedValue === "perfume") {
        type = "category";
        mapToCategorySlug = "perfume";
      } else {
        type = "tag";
        mapToTag = normalizedValue;
      }

      entries.push({
        term: rawKey,
        normalizedTerm: key,
        type,
        mapToCategorySlug,
        mapToTag,
        mapToBrand,
        confidence: 0.8, // Standard-Confidence für migrierte Aliase
        source: "static",
      });
    }
  }

  return entries;
}

/**
 * Konvertiert AliasEntry[] in die alte AliasMap-Struktur (Record<string, string[]>).
 * 
 * Diese Funktion wird für Rückwärtskompatibilität verwendet, bis alle Stellen
 * auf AliasEntry[] umgestellt sind.
 * 
 * @param entries Array von AliasEntry-Objekten
 * @param catalogKeywords Liste von bekannten Katalog-Keywords (für Filterung)
 * @returns AliasMap im alten Format
 */
export function convertAliasEntriesToMap(
  entries: AliasEntry[],
  catalogKeywords: string[]
): AliasMap {
  const known = new Set(
    (catalogKeywords || []).map((k) => normalizeAliasKey(k))
  );

  const map: AliasMap = {};

  for (const entry of entries) {
    const key = normalizeAliasKey(entry.term);
    if (!key) continue;

    // Extrahiere Mappings basierend auf Typ
    const resolved: string[] = [];

    if (entry.mapToCategorySlug) {
      resolved.push(entry.mapToCategorySlug);
    }
    if (entry.mapToTag) {
      resolved.push(entry.mapToTag);
    }
    if (entry.mapToBrand) {
      resolved.push(entry.mapToBrand);
    }

    // Filtere gegen catalogKeywords (außer bei Language-Aliases)
    const isLanguageAlias = entry.type === "category" && entry.mapToCategorySlug === "perfume";
    
    const filtered = resolved
      .map((v) => normalizeAliasKey(v))
      .filter((v) => {
        if (v.length === 0) return false;
        // Language-Aliase: Immer behalten
        if (isLanguageAlias) return true;
        // Andere: Nur wenn im Katalog vorhanden
        return known.has(v);
      });

    if (filtered.length > 0) {
      const existing = map[key] || [];
      map[key] = Array.from(new Set([...existing, ...filtered]));
    } else if (isLanguageAlias && resolved.length > 0) {
      // Language-Aliase: Immer behalten, auch wenn nicht in catalogKeywords
      const normalized = resolved.map((v) => normalizeAliasKey(v)).filter((v) => v.length > 0);
      if (normalized.length > 0) {
        map[key] = normalized;
      }
    }
  }

  return map;
}

/**
 * Generische Sprach-Aliase, die für alle Shops gelten.
 * Werden später gegen catalogKeywords gefiltert, damit nur vorhandene Tokens übrig bleiben.
 * 
 * Beispiel: "parfum" / "parfüm" -> "perfume" ist ein generischer Sprach-Alias,
 * der für alle Shops gilt und nicht shop-spezifisch ist.
 * 
 * @deprecated Verwende stattdessen loadAliasEntries() und filtere nach type === "category" && mapToCategorySlug === "perfume"
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
 * 
 * @deprecated Verwende stattdessen loadAliasEntries() und filtere nach type === "category" && mapToCategorySlug === "perfume"
 */
const LANGUAGE_ALIAS_KEYS = new Set([
  "parfum", "parfüm", "perfüm", "parfume", "perfume",
  "napf", "napfset", // Bestehende manuelle Aliase (fressnapf entfernt - soll dynamisch gelernt werden)
]);

/**
 * Initialisiert die Alias-Map aus AliasEntry[] und normalisiert alle Keys und Values.
 * 
 * WICHTIG: 
 * - Language-Aliase (z. B. "parfum" -> "perfume") bleiben IMMER erhalten, auch wenn "perfume" nicht in catalogKeywords ist.
 * - Andere Values werden nur behalten, wenn sie in catalogKeywords vorkommen.
 * 
 * @param catalogKeywords Liste von bekannten Katalog-Keywords (für Filterung)
 * @returns Normalisierte Alias-Map (alte Struktur für Rückwärtskompatibilität)
 */
export function initializeAliasMap(
  catalogKeywords: string[],
  shopDomain?: string
): AliasMap {
  // Lade AliasEntry[] aus statischen und dynamischen Quellen
  // WICHTIG: Bei jedem Start werden beide Quellen geladen (statisch + dynamisch)
  const entries = loadAliasEntries("de", shopDomain);
  
  // Konvertiere zu alter AliasMap-Struktur für Rückwärtskompatibilität
  const map = convertAliasEntriesToMap(entries, catalogKeywords);
  
  // Rückwärtskompatibilität: Ergänze alte generatedAliasMap.json (wird später entfernt)
  const known = new Set(
    (catalogKeywords || []).map((k) => normalizeAliasKey(k))
  );

  // Wichtig: JSON kann auch Meta-Keys wie "_comment": "..." enthalten
  // -> darum hier unknown statt string[]
  const raw = (generatedAliasMapJson || {}) as Record<string, unknown>;

  // 1. Aus generatedAliasMap.json (bestehende Logik beibehalten für Rückwärtskompatibilität)
  for (const [rawKey, rawValues] of Object.entries(raw)) {
    // Überspringe Metadaten-Keys
    if (rawKey.startsWith("_")) continue;

    const key = normalizeAliasKey(rawKey);
    if (!key) continue;

    // Prüfe, ob dieser Alias bereits aus entries geladen wurde
    if (map[key]) {
      // Überspringe, da bereits aus base/dynamic geladen
      continue;
    }

    const isLanguageAlias = LANGUAGE_ALIAS_KEYS.has(key);

    // Neu: nur echte Arrays weiterverarbeiten, alles andere (z. B. "_comment": "…") ignorieren
    const rawArray = Array.isArray(rawValues) ? rawValues : [];

    // Filtere Values:
    // - Bei Language-Aliases: Alle Values behalten (auch wenn nicht in catalogKeywords)
    // - Bei anderen: Nur solche, die im Katalog vorkommen
    const values = Array.from(
      new Set(
        (rawArray || [])
          .map((v) =>
            typeof v === "string" ? normalizeAliasKey(v) : ""
          )
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
      const rawNormalized = (rawArray || [])
        .map((v) =>
          typeof v === "string" ? normalizeAliasKey(v) : ""
        )
        .filter((v) => v.length > 0);

      if (rawNormalized.length > 0) {
        map[key] = rawNormalized;
      }
      continue;
    }

    if (values.length === 0) continue;

    const existing = map[key] || [];
    map[key] = Array.from(new Set([...existing, ...values]));
  }

  // 2. Sprach-Aliase ergänzen (OHNE Filterung gegen catalogKeywords)
  // (dein bestehender Block – unverändert lassen für Rückwärtskompatibilität)
  for (const [rawKey, rawValues] of Object.entries(LANGUAGE_ALIAS_SEEDS)) {
    const key = normalizeAliasKey(rawKey);
    if (!key) continue;

    // Prüfe, ob bereits vorhanden
    if (map[key]) {
      continue;
    }

    const normalizedValues = Array.from(
      new Set(
        (rawValues || [])
          .map((v) => normalizeAliasKey(v))
          .filter((v) => v.length > 0)
      )
    );

    if (normalizedValues.length > 0) {
      const existing = map[key] || [];
      const merged = Array.from(new Set([...existing, ...normalizedValues]));
      map[key] = merged;
    }
  }

  // Debug-Log
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    const parfumKey = normalizeAliasKey("parfum");
    const parfümKey = normalizeAliasKey("parfüm");
    console.log("[EFRO AliasMapInit]", {
      catalogKeywordsCount: known.size,
      aliasKeys: Object.keys(map).slice(0, 20),
      aliasKeysCount: Object.keys(map).length,
      entriesCount: entries.length,
      parfumEntry: map[parfumKey] || null,
      parfümEntry: map[parfümKey] || null,
      hasPerfumeInKnown: known.has("perfume"),
      exampleKnown: Array.from(known)
        .slice(0, 20)
        .filter((k) => k.includes("perf") || k.includes("duft")),
    });
  }

  return map;
}
