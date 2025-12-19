// scripts/generateAliasMapFromAI.ts
//
// Dieses Script generiert automatisch eine Alias-Map fÃ¼r EFRO per OpenAI-API.
// Die Alias-Map ordnet unbekannte Kundenbegriffe bekannten Katalog-Keywords zu.
//
// PRODUKTQUELLEN:
// - efroAttributeTestProducts aus src/lib/catalog/efro-attribute-test-products.ts
// Diese Quelle entspricht dem Katalog, der auch im Avatar-Seller verwendet wird.
// Quelle: efroAttributeTestProducts aus src/lib/catalog/efro-attribute-test-products.ts
//
// NORMALISIERUNG:
// normalizeText wird lokal implementiert (gleiche Logik wie in sellerBrain.ts),
// da die Funktion dort nicht exportiert ist.
//
// USAGE:
//   OPENAI_API_KEY=EXAMPLE_KEY npx tsx scripts/generateAliasMapFromAI.ts
//
// WICHTIG:
// - Bestehende manuelle Aliase (z. B. fressnapf) haben Vorrang vor AI-generierten.
// - Nur Katalog-Keywords, die wirklich im Katalog vorkommen, werden verwendet.

import { writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// TypeScript-Pfad-AuflÃ¶sung fÃ¼r ES-Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Typen
type EFROProduct = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
};

type AliasMap = Record<string, string[]>;

// Pfade
const projectRoot = join(__dirname, "..");
const aliasMapPath = join(projectRoot, "src", "lib", "sales", "generatedAliasMap.json");

/**
 * Normalisiert Text exakt wie in sellerBrain.ts
 * (gleiche Logik fÃ¼r Konsistenz)
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalisiert einen Alias-Key (konsistent mit aliasMap.ts)
 * Entfernt alle Sonderzeichen und Leerzeichen
 */
function normalizeAliasKey(key: string): string {
  if (!key) return "";
  return key
    .toLowerCase()
    .replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ]/gi, "") // Alle Sonderzeichen entfernen
    .trim();
}

/**
 * LÃ¤dt die bestehende Alias-Map aus generatedAliasMap.json
 * Falls Datei nicht existiert oder Fehler â†’ leeres Objekt
 */
async function loadExistingAliasMap(): Promise<AliasMap> {
  try {
    const content = await readFile(aliasMapPath, "utf8");
    const parsed = JSON.parse(content) as AliasMap;
    return parsed || {};
  } catch (err) {
    console.log("[EFRO AliasBatch] Bestehende Alias-Map nicht gefunden oder Fehler beim Lesen:", (err as Error).message);
    return {};
  }
}

/**
 * Konsolidiert alle Produktlisten, die auch im Avatar-Seller verwendet werden
 * 
 * Verwendet efroAttributeTestProducts aus src/lib/catalog/efro-attribute-test-products.ts
 * Diese Datei enthÃ¤lt die wichtigsten Test-Produkte fÃ¼r die Attribut-Engine.
 * 
 * Da die Datei @/ Imports verwendet, die in ts-node nicht funktionieren,
 * verwenden wir einen dynamischen Import mit relativem Pfad ohne Extension.
 */
async function getAllProductsForAliasGeneration(): Promise<EFROProduct[]> {
  // Nutze NUR die Produkte aus efro-attribute-test-products.ts
  // Verwende absoluten file:// URL fÃ¼r ts-node KompatibilitÃ¤t
  const efroAttributeTestProductsPath = join(projectRoot, "src", "lib", "catalog", "efro-attribute-test-products.ts");
  const efroAttributeTestProductsUrl = pathToFileURL(efroAttributeTestProductsPath).href;
  
  try {
    const module = await import(efroAttributeTestProductsUrl);
    const products = module?.efroAttributeTestProducts || [];
    if (products.length === 0) {
      throw new Error("efroAttributeTestProducts ist leer oder nicht gefunden");
    }
    return products;
  } catch (err) {
    throw new Error(`Konnte efroAttributeTestProducts nicht laden: ${(err as Error).message}`);
  }
}

/**
 * Extrahiert alle Katalog-Keywords aus Produkten
 * (gleiche Logik wie in sellerBrain.ts fÃ¼r catalogKeywords)
 */
function buildCatalogKeywords(products: EFROProduct[]): string[] {
  const tokenSet = new Set<string>();

  for (const product of products) {
    const fields: string[] = [
      product.title ?? "",
      product.category ?? "",
      ...(product.tags ?? []),
      product.description ?? "",
    ];

    const joined = fields.join(" ");
    const normalized = normalizeText(joined);
    const rawTokens = normalized.split(/\s+/);

    for (const token of rawTokens) {
      const t = token.trim();
      if (!t) continue;
      if (t.length < 3) continue; // zu kurz, eher StoppwÃ¶rter
      tokenSet.add(t);
    }
  }

  return Array.from(tokenSet).sort();
}

/**
 * Filtert Katalog-Keywords auf relevante canonicalTokens
 * (Kategorien, wichtige TitelwÃ¶rter, Tags - keine StopwÃ¶rter)
 */
function buildCanonicalTokens(products: EFROProduct[]): string[] {
  const tokenSet = new Set<string>();
  const stopWords = new Set([
    "fÃ¼r", "und", "oder", "der", "die", "das", "den", "dem", "des",
    "mit", "von", "zu", "auf", "in", "an", "aus", "bei", "nach",
    "ist", "sind", "war", "waren", "wird", "werden", "hat", "haben",
    "kann", "kÃ¶nnen", "soll", "sollen", "muss", "mÃ¼ssen",
    "alle", "jede", "jeder", "jedes", "manche", "viele", "wenige",
    "mehr", "weniger", "sehr", "ganz", "etwas", "nichts",
  ]);

  for (const product of products) {
    // Kategorien sind immer relevant
    if (product.category) {
      const catNormalized = normalizeText(product.category);
      const catTokens = catNormalized.split(/\s+/).filter((t) => t.length >= 3);
      catTokens.forEach((t) => {
        if (!stopWords.has(t)) {
          tokenSet.add(t);
        }
      });
      // Auch die gesamte normalisierte Kategorie als Token (z. B. "perfume" aus "Perfume")
      const fullCat = normalizeAliasKey(product.category);
      if (fullCat && fullCat.length >= 3 && !stopWords.has(fullCat)) {
        tokenSet.add(fullCat);
      }
    }

    // Tags sind relevant
    if (product.tags && Array.isArray(product.tags)) {
      product.tags.forEach((tag) => {
        const tagNormalized = normalizeText(String(tag));
        const tagTokens = tagNormalized.split(/\s+/).filter((t) => t.length >= 3);
        tagTokens.forEach((t) => {
          if (!stopWords.has(t)) {
            tokenSet.add(t);
          }
        });
      });
    }

    // Wichtige TitelwÃ¶rter (erste 2-3 WÃ¶rter)
    if (product.title) {
      const titleNormalized = normalizeText(product.title);
      const titleTokens = titleNormalized.split(/\s+/).filter((t) => t.length >= 3);
      // Erste 3 WÃ¶rter sind meist wichtig
      titleTokens.slice(0, 3).forEach((t) => {
        if (!stopWords.has(t)) {
          tokenSet.add(t);
        }
      });
    }
  }

  return Array.from(tokenSet).sort();
}

/**
 * Ruft OpenAI-API auf, um Synonyme fÃ¼r einen einzelnen canonicalToken zu generieren
 */
async function callOpenAIForTokenSynonyms(canonicalToken: string): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY ist nicht gesetzt. Bitte als Umgebungsvariable setzen.");
  }

  const systemPrompt = `
Du bist ein E-Commerce-Suchassistent fÃ¼r einen Online-Shop.
Ich gebe dir ein Katalog-Token, das als interne Kategorie oder Produkt-SchlÃ¼ssel dient.

Deine Aufgabe:
Gib mir eine Liste typischer deutscher Kundensuchbegriffe und alternativer Schreibweisen, mit denen echte Kunden nach genau diesem Produkt suchen wÃ¼rden.

BerÃ¼cksichtige:
- andere Schreibweisen (z. B. parfum, parfÃ¼m)
- mundartliche Begriffe
- Singular/Plural
- aber KEINE Begriffe, die zu anderen Kategorien gehÃ¶ren.

Gib als Antwort NUR eine JSON-Liste von Strings, z. B.: ["parfum","parfÃ¼m","duftspray"].
KEINE ErklÃ¤rungen, KEIN Markdown, KEINE Kommentare.
`.trim();

  const userPrompt = `
KATALOG-TOKEN: ${canonicalToken}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[EFRO AliasBatch] OpenAI-Fehler fÃ¼r Token "${canonicalToken}": ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();

    if (!text) {
      console.warn(`[EFRO AliasBatch] OpenAI-Antwort ohne Content fÃ¼r Token "${canonicalToken}"`);
      return [];
    }

    // Text muss reines JSON-Array sein
    let parsed: unknown;
    try {
      const cleaned = text
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.warn(`[EFRO AliasBatch] Konnte JSON fÃ¼r Token "${canonicalToken}" nicht parsen: ${(err as Error).message}`);
      return [];
    }

    // PrÃ¼fe, ob es ein Array ist
    if (!Array.isArray(parsed)) {
      console.warn(`[EFRO AliasBatch] Antwort fÃ¼r Token "${canonicalToken}" ist kein Array`);
      return [];
    }

    // Normalisiere alle Synonyme mit normalizeAliasKey (konsistent mit sellerBrain)
    return parsed
      .map((s) => String(s))
      .filter((s) => s.length > 0)
      .map((s) => normalizeAliasKey(s)); // Konsistente Normalisierung
  } catch (err) {
    console.warn(`[EFRO AliasBatch] Fehler beim Aufruf fÃ¼r Token "${canonicalToken}": ${(err as Error).message}`);
    return [];
  }
}

/**
 * Generiert Alias-Map fÃ¼r alle canonicalTokens
 */
async function generateAliasMapForTokens(canonicalTokens: string[]): Promise<AliasMap> {
  const aliasMap: AliasMap = {};
  const limitedTokens = canonicalTokens.slice(0, 100); // Begrenze auf 100 Tokens

  console.log(`[EFRO AliasBatch] Generiere Aliase fÃ¼r ${limitedTokens.length} canonicalTokens...`);

  for (let i = 0; i < limitedTokens.length; i++) {
    const token = limitedTokens[i];
    // Normalisiere den canonicalToken (konsistent mit catalogKeywords)
    const normalizedCanonical = normalizeAliasKey(token);
    
    if (!normalizedCanonical) continue; // Ãœberspringe leere Tokens
    
    const synonyms = await callOpenAIForTokenSynonyms(token);

    if (synonyms.length > 0) {
      // FÃ¼r jedes Synonym: Key = Synonym, Value = [canonicalToken]
      for (const synonym of synonyms) {
        const normalizedSynonym = normalizeAliasKey(synonym);
        
        // Ãœberspringe leere Synonyme oder Self-Mappings
        if (!normalizedSynonym || normalizedSynonym === normalizedCanonical) {
          continue;
        }
        
        // Initialisiere Array falls nÃ¶tig
        if (!aliasMap[normalizedSynonym]) {
          aliasMap[normalizedSynonym] = [];
        }
        
        // Nur hinzufÃ¼gen, wenn noch nicht vorhanden
        if (!aliasMap[normalizedSynonym].includes(normalizedCanonical)) {
          aliasMap[normalizedSynonym].push(normalizedCanonical);
        }
      }
    }

    // Progress-Log alle 10 Tokens
    if ((i + 1) % 10 === 0) {
      console.log(`[EFRO AliasBatch] Fortschritt: ${i + 1}/${limitedTokens.length} Tokens verarbeitet`);
    }

    // Kurze Pause zwischen API-Calls (Rate-Limiting)
    if (i < limitedTokens.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return aliasMap;
}

/**
 * Filtert Alias-Map: Nur Ziel-Tokens (Values), die auch im Katalog existieren
 * Keys (Aliase) bleiben unberÃ¼hrt, auch wenn sie nicht im Katalog vorkommen
 */
function filterAliasMapAgainstCatalog(aliasMap: AliasMap, catalogKeywords: string[]): AliasMap {
  // Normalisiere catalogKeywords fÃ¼r Vergleich
  const known = new Set(
    catalogKeywords.map((k) => normalizeAliasKey(k))
  );
  
  const result: AliasMap = {};

  for (const [aliasRaw, targetsRaw] of Object.entries(aliasMap)) {
    // Key normalisieren (Alias bleibt erhalten, auch wenn nicht im Katalog)
    const alias = normalizeAliasKey(aliasRaw);
    
    // Values (canonicalTokens) filtern: Nur solche, die im Katalog vorkommen
    const cleanedTargets = Array.from(
      new Set(
        (targetsRaw || [])
          .map((t) => normalizeAliasKey(t))
          .filter((t) => t.length > 0 && known.has(t)) // Nur Katalog-Keywords behalten
      )
    );

    // Nur EintrÃ¤ge behalten, die mindestens einen gÃ¼ltigen Target haben
    if (alias && cleanedTargets.length > 0) {
      result[alias] = cleanedTargets;
    }
  }

  return result;
}

/**
 * Liste von Language-Alias-Keys, die NIEMALS von AI Ã¼berschrieben werden dÃ¼rfen
 * (generische Sprach-Aliase, die fÃ¼r alle Shops gelten)
 */
const PROTECTED_LANGUAGE_ALIAS_KEYS = new Set([
  "parfum", "parfÃ¼m", "perfÃ¼m", "parfume", "perfume",
  "fressnapf", "napf", "napfset", // Bestehende manuelle Aliase
]);

/**
 * Merged bestehende (manuelle) und AI-generierte Alias-Maps
 * Bestehende haben Vorrang (Ã¼berschreiben/ergÃ¤nzen AI-EintrÃ¤ge)
 * Language-Aliase werden NIEMALS Ã¼berschrieben
 */
function mergeAliasMaps(existing: AliasMap, aiGenerated: AliasMap): AliasMap {
  // Starte mit AI-generierten EintrÃ¤gen
  const merged: AliasMap = { ...aiGenerated };

  // Bestehende (manuelle) EintrÃ¤ge haben Vorrang
  for (const [alias, targets] of Object.entries(existing)) {
    // Ãœberspringe Metadaten-Keys
    if (alias.startsWith("_")) continue;
    
    const key = normalizeAliasKey(alias);
    if (!key) continue;
    
    const isProtected = PROTECTED_LANGUAGE_ALIAS_KEYS.has(key);
    
    const existingTargets = new Set<string>();

    // FÃ¼ge alle Targets aus bestehender Map hinzu
    for (const t of targets) {
      const normalizedTarget = normalizeAliasKey(t);
      if (normalizedTarget) {
        existingTargets.add(normalizedTarget);
      }
    }

    // Wenn bereits AI-EintrÃ¤ge vorhanden UND nicht geschÃ¼tzt:
    // Mergen (deduplizieren), aber bestehende Targets haben Vorrang
    if (merged[key] && !isProtected) {
      const aiTargets = merged[key].map((t) => normalizeAliasKey(t));
      aiTargets.forEach((t) => {
        if (t) existingTargets.add(t);
      });
    }

    // GeschÃ¼tzte Language-Aliase: IMMER Ã¼berschreiben (bestehende haben absoluten Vorrang)
    // Andere: Mergen
    if (isProtected || existingTargets.size > 0) {
      merged[key] = Array.from(existingTargets);
    }
  }

  // Entferne AI-generierte EintrÃ¤ge, die geschÃ¼tzte Keys Ã¼berschreiben wÃ¼rden
  for (const protectedKey of PROTECTED_LANGUAGE_ALIAS_KEYS) {
    if (merged[protectedKey] && !existing[protectedKey]) {
      // Falls AI einen geschÃ¼tzten Key generiert hat, aber existing ihn nicht hat,
      // behalte den AI-Eintrag (kann als ErgÃ¤nzung dienen)
      // Aber wenn existing ihn hat, wurde er bereits oben Ã¼berschrieben
    }
  }

  return merged;
}

/**
 * Hauptfunktion
 */
async function main() {
  console.log("[EFRO AliasBatch] Starte Alias-Generierung...");

  const existingAliasMap = await loadExistingAliasMap();
  console.log("[EFRO AliasBatch] Bestehende Aliase:", Object.keys(existingAliasMap).length);

  const products = await getAllProductsForAliasGeneration();
  console.log("[EFRO AliasBatch] Produktanzahl:", products.length);

  const catalogKeywords = buildCatalogKeywords(products);
  console.log("[EFRO AliasBatch] Katalog-Tokens:", catalogKeywords.length);

  const canonicalTokens = buildCanonicalTokens(products);
  console.log("[EFRO AliasBatch] Canonical-Tokens:", canonicalTokens.length);

  const aiAliasMapRaw = await generateAliasMapForTokens(canonicalTokens);
  console.log("[EFRO AliasBatch] AI-Aliase (roh):", Object.keys(aiAliasMapRaw).length);

  const aiAliasMapFiltered = filterAliasMapAgainstCatalog(aiAliasMapRaw, catalogKeywords);
  console.log("[EFRO AliasBatch] AI-Aliase (gefiltert):", Object.keys(aiAliasMapFiltered).length);

  const finalAliasMap = mergeAliasMaps(existingAliasMap, aiAliasMapFiltered);
  console.log("[EFRO AliasBatch] Finale Alias-Map:", Object.keys(finalAliasMap).length);

  await writeFile(aliasMapPath, JSON.stringify(finalAliasMap, null, 2), "utf8");
  console.log("[EFRO AliasBatch] Alias-Map gespeichert unter:", aliasMapPath);
  console.log("[EFRO AliasBatch] âœ… Fertig!");
}

main().catch((err) => {
  console.error("[EFRO AliasBatch] Fehler:", err);
  process.exit(1);
});

// Alias-Batch verwendet aktuell:
// - efroAttributeTestProducts aus src/lib/catalog/efro-attribute-test-products.ts
