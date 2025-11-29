// src/lib/sales/sellerBrain.ts

import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
// Import der generierten Hints aus JSON
// Hinweis: TypeScript erwartet hier einen Typ-Assertion, da JSON-Imports als any kommen
import generatedProductHintsJson from "./generatedProductHints.json";
// Import der Alias-Map für AI-gestützte Begriff-Auflösung
import type { AliasMap } from "./aliasMap";
import { normalizeAliasKey, initializeAliasMap } from "./aliasMap";

/**
 * Ergebnisstruktur des Seller-Gehirns
 */
export type SellerBrainResult = {
  intent: ShoppingIntent;
  recommended: EfroProduct[];
  replyText: string;
};

type ExplanationMode = "ingredients" | "materials" | "usage" | "care" | "washing";

/**
 * Attribut-Map pro Produkt
 * z. B. { skin_type: ["dry", "sensitive"], audience: ["men"], room: ["bathroom"] }
 */
type ProductAttributeMap = Record<string, string[]>;

/**
 * Vokabular-Eintrag für ein Attribut auf Shop-Ebene
 */
type ShopAttributeVocabulary = {
  key: string;           // z. B. "skin_type", "audience", "room", "pet", "family"
  values: string[];      // z. B. ["dry", "sensitive", "oily"]
  examples: string[];    // Produkt-Titel-Beispiele (max. 3)
  usageCount: number;    // Anzahl Produkte, die dieses Attribut verwenden
};

/**
 * Vollständiger Attribut-Index für den Shop
 */
type AttributeIndex = {
  perProduct: Record<string, ProductAttributeMap>;  // Key = product.id
  vocabulary: ShopAttributeVocabulary[];
};

/**
 * Typ für Produkt-Hints (statisch oder generiert)
 */
export type ProductHint = {
  keyword: string;
  categoryHint?: string;
  attributes?: string[];
  weight?: number;
};

/**
 * Zentrale Text-Normalisierung (vereinheitlicht)
 * – Umlaute bleiben erhalten, damit Stopwords wie "für", "größer" etc. sauber matchen.
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Kategorien, die typischerweise für menschliche Haut-/Kosmetik-Produkte verwendet werden
 */
const HUMAN_SKIN_CATEGORIES = [
  "kosmetik",
  "beauty",
  "pflege",
  "haut",
  "gesicht",
  "body",
];

/**
 * Nutzertext normalisieren (Legacy-Kompatibilität)
 */
function normalize(text: string): string {
  return normalizeText(text);
}

/**
 * Statische Produkt-Hints (manuell gepflegt)
 * Wird als string[] exportiert, um bestehenden Code nicht zu brechen.
 */
export const productHints: string[] = [
  "duschgel",
  "shampoo",
  "gel",
  "öl",
  "seife",
  "hund",
  "katze",
  "spielzeug",
  "produkt",
  "produkte",
  "shop",
  "kaufen",
  "preis",
  "kosten",
  "angebot",
  "rabatt",
  "größe",
  "groesse",
  "farbe",
  "variant",
  "haushalt",
  "haushaltswaren",
  "kosmetik",
  "tiere",
  "haustier",
  "zeig",
  "zeige",
  "suche",
  "suchen",
  "finde",
  "finden",
  "empfehl",
  "vorschlag",
  "was",
  "welch",
  "welche",
  "welches",

  // NEU: Haut-/Haar-Attribute, damit Fragen wie
  // "Ist es für trockene Haut?" nicht mehr als Off-Topic gelten
  "haut",
  "haare",
  "trockene",
  "trocken",
  "empfindliche",
  "empfindlich",
  "sensible",
  "sensibel",
  "pflege",

  // Reinigungs-/Verschmutzungsbegriffe
  "schmutz",
  "verschmutz",
  "verschmutzungen",
  "fleck",
  "flecken",
  "kalk",
  "reinigen",
  "reinigung",
  "entfernen",

  // Anti-Aging / reife Haut
  "anti-aging",
  "anti aging",
  "antiaging",
  "anti age",
  "reife haut",
  "mature skin",
];

/**
 * Typisierte Version der statischen Hints
 * Wird aus productHints generiert, um Kompatibilität zu gewährleisten.
 */
export const staticProductHints: ProductHint[] = productHints.map((keyword) => ({
  keyword,
  weight: 1,
}));

/**
 * Führt statische und generierte Hints zusammen.
 * 
 * Regeln:
 * - Statische Hints haben Priorität bei Duplikaten
 * - Wenn beide ein weight haben, wird das höhere verwendet
 * - Generierte Hints ohne Duplikate werden übernommen
 * 
 * @param staticHints Statische, manuell gepflegte Hints
 * @param generatedHints Optional: Dynamisch generierte Hints (z. B. aus JSON)
 * @returns Zusammengeführte Liste von ProductHint
 */
function mergeHints(
  staticHints: ProductHint[],
  generatedHints?: ProductHint[]
): ProductHint[] {
  // Wenn keine generierten Hints vorhanden, nur statische zurückgeben
  if (!generatedHints || generatedHints.length === 0) {
    return [...staticHints];
  }

  // Map für schnelles Lookup nach keyword
  const mergedMap = new Map<string, ProductHint>();

  // Zuerst alle statischen Hints einfügen (haben Priorität)
  for (const hint of staticHints) {
    mergedMap.set(hint.keyword.toLowerCase(), { ...hint });
  }

  // Dann generierte Hints hinzufügen, falls nicht bereits vorhanden
  for (const hint of generatedHints) {
    const key = hint.keyword.toLowerCase();
    const existing = mergedMap.get(key);

    if (!existing) {
      // Neues Keyword → übernehmen
      mergedMap.set(key, { ...hint });
    } else {
      // Duplikat: Statischer Hint hat Priorität, aber weight kann überschrieben werden
      // wenn der generierte Hint ein höheres weight hat
      if (
        hint.weight !== undefined &&
        (existing.weight === undefined || hint.weight > existing.weight)
      ) {
        existing.weight = hint.weight;
      }
      // Weitere Felder (categoryHint, attributes) können optional vom generierten Hint ergänzt werden,
      // wenn sie im statischen Hint fehlen
      if (!existing.categoryHint && hint.categoryHint) {
        existing.categoryHint = hint.categoryHint;
      }
      if (!existing.attributes && hint.attributes) {
        existing.attributes = hint.attributes;
      }
    }
  }

  // In Array konvertieren und sortieren (optional: nach weight absteigend, dann alphabetisch)
  const merged = Array.from(mergedMap.values());
  merged.sort((a, b) => {
    // Zuerst nach weight (höher = besser)
    const weightA = a.weight ?? 0;
    const weightB = b.weight ?? 0;
    if (weightB !== weightA) {
      return weightB - weightA;
    }
    // Dann alphabetisch nach keyword
    return a.keyword.localeCompare(b.keyword);
  });

  return merged;
}

// initializeAliasMap ist jetzt in aliasMap.ts definiert und wird von dort importiert

/**
 * Gibt die aktuell aktiven Produkt-Hints zurück.
 * 
 * Kombiniert statische Hints (manuell gepflegt) mit generierten Hints
 * aus generatedProductHints.json.
 * 
 * @returns Array von ProductHint
 */
function getActiveProductHints(): ProductHint[] {
  try {
    // Generierte Hints aus JSON laden (als ProductHint[] casten)
    const generatedHints: ProductHint[] =
      (generatedProductHintsJson as unknown as ProductHint[]) ?? [];

    // Statische und generierte Hints zusammenführen
    const merged = mergeHints(staticProductHints, generatedHints);

    console.log("[EFRO ActiveHints]", {
      staticCount: staticProductHints.length,
      generatedCount: generatedHints.length,
      mergedCount: merged.length,
    });

    return merged;
  } catch (err) {
    console.error("[EFRO ActiveHints ERROR]", err);
    // Fallback nur auf statische Hints bei Fehler
    return staticProductHints;
  }
}

/**
 * Erkennt, ob der Nutzer eher eine Erklärung will
 * (Inhaltsstoffe / Material / Anwendung / Pflege).
 */
function detectExplanationMode(text: string): ExplanationMode | null {
  const t = normalize(text || "");
  if (!t) return null;

  // Zutaten / Inhaltsstoffe
  if (
    t.includes("inhaltsstoff") ||
    t.includes("inhaltsstoffe") ||
    t.includes("zutaten") ||
    t.includes("ingredients")
  ) {
    return "ingredients";
  }

  // Anwendung / benutzen
  if (
    t.includes("wie verwende ich") ||
    t.includes("wie benutze ich") ||
    t.includes("wie nutze ich") ||
    t.includes("anwendung")
  ) {
    return "usage";
  }

  // Waschen / Pflege
  if (
    t.includes("wie kann ich das waschen") ||
    t.includes("wie kann ich das reinigen") ||
    t.includes("wie wasche ich das") ||
    t.includes("waschhinweis") ||
    t.includes("pflegehinweis")
  ) {
    return "washing";
  }

  // materials / care könnten später hier ergänzt werden

  return null;
}

/**
 * Prüft, ob der Text produktbezogen ist
 */
function isProductRelated(text: string): boolean {
  const t = normalize(text || "");

  // Kern-Produkt-Keywords: Wenn eines davon vorkommt, ist es immer produktbezogen
  const coreProductKeywords = [
    "shampoo",
    "duschgel",
    "reiniger",
    "spray",
    "lotion",
    "creme",
    "cream",
    "seife",
    "soap",
    "tücher",
    "tuecher",
    "tuch",
    "wipes",

    // Näpfe/Fressnäpfe
    "napf",
    "fressnapf",
    "futternapf",

    // Reinigungs-/Verschmutzungsbegriffe
    "schmutz",
    "verschmutz",
    "verschmutzungen",
    "fleck",
    "flecken",
    "kalk",
    "reinigen",
    "reinigung",
    "entfernen",

    // Anti-Aging / reife Haut – explizit als Produktkontext
    "anti-aging",
    "anti aging",
    "antiaging",
    "anti age",
  ];

  // Sofort true, wenn ein Kern-Produkt-Keyword gefunden wird
  if (coreProductKeywords.some((w) => t.includes(w))) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: "coreProductKeyword",
    });
    return true;
  }

  // Kontext-Keywords: "für die Küche", "fürs Bad", etc.
  const contextKeywords = [
    "für die küche",
    "fürs bad",
    "fürs badezimmer",
    "fürs schlafzimmer",
    "für hunde",
    "für katzen",
    "für kinder",
    "für die küche",
    "für die bad",
    "für die badezimmer",
    "für die schlafzimmer",
  ];

  if (contextKeywords.some((w) => t.includes(w))) {
    console.log("[EFRO ProductRelated]", {
      text,
      isProductRelated: true,
      reason: "contextKeyword",
    });
    return true;
  }

  // Wörter, die auf typische Produkt-/Shopfragen hindeuten
  // HINWEIS: Die lokale productHints-Liste wurde entfernt.
  // Stattdessen wird getActiveProductHints() verwendet, um künftig
  // auch generierte Hints zu berücksichtigen.

  const activeHints = getActiveProductHints();
  const result = activeHints.some((hint) => t.includes(hint.keyword));
  console.log("[EFRO ProductRelated]", {
    text,
    isProductRelated: result,
    reason: result ? "productHint" : "none",
  });
  return result;
}

/**
 * Hilfsfunktionen für Intent-Detection
 */
function detectIntentFromText(
  text: string,
  currentIntent: ShoppingIntent
): ShoppingIntent {
  const t = normalize(text);

  const premiumWords = [
    "premium",
    "beste",
    "hochwertig",
    "qualitaet",
    "qualitat",
    "luxus",
    "teuer",
  ];
  const bargainWords = [
    "billig",
    "guenstig",
    "günstig",
    "discount",
    "spar",
    "rabatt",
    "deal",
    "bargain",
    "günstigste",
    "günstigsten",
  ];
  const giftWords = ["geschenk", "gift", "praesent", "praes", "present"];
  const bundleWords = ["bundle", "set", "paket", "combo"];
  const exploreWords = [
    "zeig mir was",
    "inspiration",
    "zeige mir",
    "was hast du",
    "was gibt es",
  ];

  if (premiumWords.some((w) => t.includes(w))) {
    return "premium";
  }
  if (bargainWords.some((w) => t.includes(w))) {
    return "bargain";
  }
  if (giftWords.some((w) => t.includes(w))) {
    return "gift";
  }
  if (bundleWords.some((w) => t.includes(w))) {
    return "bundle";
  }
  if (exploreWords.some((w) => t.includes(w))) {
    return "explore";
  }

  return currentIntent || "quick_buy";
}

/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 */
function extractUserPriceRange(
  text: string
): { minPrice: number | null; maxPrice: number | null } {
  const t = normalize(text);

  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // 1) "zwischen 30 und 50 Euro"
  const betweenMatch = t.match(
    /zwischen\s+(\d+)\s*(und|-)\s*(\d+)\s*(euro|eur|€)/
  );
  if (betweenMatch) {
    const v1 = parseInt(betweenMatch[1], 10);
    const v2 = parseInt(betweenMatch[3], 10);
    if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
      minPrice = Math.min(v1, v2);
      maxPrice = Math.max(v1, v2);
      return { minPrice, maxPrice };
    }
  }

  // 2) "von 30 bis 50 Euro"
  const fromToMatch = t.match(/von\s+(\d+)\s*(bis|-)\s*(\d+)\s*(euro|eur|€)/);
  if (fromToMatch) {
    const v1 = parseInt(fromToMatch[1], 10);
    const v2 = parseInt(fromToMatch[3], 10);
    if (!Number.isNaN(v1) && !Number.isNaN(v2)) {
      minPrice = Math.min(v1, v2);
      maxPrice = Math.max(v1, v2);
      return { minPrice, maxPrice };
    }
  }

  // 3) Standard-Fall: genau EINE Zahl mit "Euro/EUR/€"
  const priceMatch = t.match(/(\d+)\s*(euro|eur|€)/);
  if (!priceMatch) {
    return { minPrice, maxPrice };
  }

  const value = parseInt(priceMatch[1], 10);
  if (Number.isNaN(value)) {
    return { minPrice, maxPrice };
  }

  const prefix = t.slice(0, priceMatch.index ?? 0);

  const hasUnder =
    /unter|bis|höchstens|hoechstens|maximal|weniger als/.test(prefix);
  const hasOver = /über|ueber|mindestens|ab|mehr als/.test(prefix);

  if (hasUnder && !hasOver) {
    maxPrice = value;
  } else if (hasOver && !hasUnder) {
    minPrice = value;
  } else {
    maxPrice = value;
  }

  return { minPrice, maxPrice };
}

/**
 * Baut einen dynamischen Attribut-Index aus allen Produkten.
 *
 * Erkennt heuristisch Attribute wie:
 * - skin_type: "dry", "sensitive", "oily", "combination", "mature"
 * - audience: "men", "women", "kids", "baby", "unisex"
 * - pet: "dog", "cat", "pet"
 * - room: "bathroom", "kitchen", "living_room", "bedroom"
 * - family: "shower_gel", "shampoo", "hoodie", "cleaner", "wipes", "spray", "cream", "oil", "soap"
 *
 * Diese Funktion wird in einem späteren Schritt von EFRO genutzt,
 * um pro Shop eine Lernbasis für Attribute aufzubauen.
 */
function buildAttributeIndex(allProducts: EfroProduct[]): AttributeIndex {
  const perProduct: Record<string, ProductAttributeMap> = {};

  // Vokabular-Sammlung: key -> { values: Set, examples: string[], count: number }
  const vocabMap = new Map<
    string,
    {
      values: Set<string>;
      examples: string[];
      usageCount: number;
    }
  >();

  /**
   * Hilfsfunktion: Fügt ein Attribut zu einem Produkt hinzu
   */
  function addAttribute(
    productId: string,
    attributeKey: string,
    attributeValue: string
  ): void {
    if (!perProduct[productId]) {
      perProduct[productId] = {};
    }

    const productAttrs = perProduct[productId];

    if (!productAttrs[attributeKey]) {
      productAttrs[attributeKey] = [];
    }

    if (!productAttrs[attributeKey].includes(attributeValue)) {
      productAttrs[attributeKey].push(attributeValue);
    }

    if (!vocabMap.has(attributeKey)) {
      vocabMap.set(attributeKey, {
        values: new Set<string>(),
        examples: [],
        usageCount: 0,
      });
    }

    const vocab = vocabMap.get(attributeKey)!;
    vocab.values.add(attributeValue);
    vocab.usageCount += 1;

    // Beispiel-Titel hinzufügen (max. 3 verschiedene)
    const product = allProducts.find((p) => p.id === productId);
    if (product && vocab.examples.length < 3) {
      if (!vocab.examples.includes(product.title)) {
        vocab.examples.push(product.title);
      }
    }
  }

  /**
   * Hilfsfunktion: Erkennt Hauttyp-Attribute
   */
  function detectSkinType(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /trockenhaut|trockene\s+haut|trockener\s+haut|dry\s+skin/.test(normalized)
    ) {
      addAttribute(productId, "skin_type", "dry");
    }

    if (
      /empfindliche\s+haut|empfindlicher\s+haut|empfindlich|sensible\s+haut|sensibler\s+haut|sensitive\s+skin/.test(
        normalized
      )
    ) {
      addAttribute(productId, "skin_type", "sensitive");
    }

    if (
      /fettige\s+haut|fettiger\s+haut|fettig|oily\s+skin/.test(normalized)
    ) {
      addAttribute(productId, "skin_type", "oily");
    }

    if (/mischhaut|combination\s+skin/.test(normalized)) {
      addAttribute(productId, "skin_type", "combination");
    }

    if (
      /reife\s+haut|reifer\s+haut|reif|mature\s+skin|anti-?aging|anti\s+aging/.test(
        normalized
      )
    ) {
      addAttribute(productId, "skin_type", "mature");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Zielgruppe (Audience)
   */
  function detectAudience(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+herren|für\s+männer|for\s+men\b|herren\b|männer\b|\bmen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "men");
    }

    if (
      /für\s+damen|für\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "women");
    }

    if (
      /für\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|für\s+jungs|für\s+mädchen/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "kids");
    }

    if (
      /für\s+babys|für\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "audience", "baby");
    }

    if (/unisex\b|für\s+alle|for\s+all\b/.test(normalized)) {
      addAttribute(productId, "audience", "unisex");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Tier-Attribute
   */
  function detectPet(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+hunde|for\s+dog\b|\bhund\b|\bhunde\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "dog");
    }

    if (
      /für\s+katzen|for\s+cat\b|\bkatze\b|\bkatzen\b|\bcat\b|\bcats\b|\bkitten\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "pet", "cat");
    }

    if (
      !perProduct[productId]?.pet &&
      /haustier|haustiere|\bpet\b|\bpets\b|für\s+tiere/.test(normalized)
    ) {
      addAttribute(productId, "pet", "pet");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Raum / Einsatzort
   */
  function detectRoom(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (
      /für\s+bad|für\s+badezimmer|for\s+bathroom\b|\bbad\b|\bbadezimmer\b|\bbathroom\b|\bbath\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "bathroom");
    }

    if (
      /für\s+küche|für\s+kueche|for\s+kitchen\b|\bküche\b|\bkueche\b|\bkitchen\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "kitchen");
    }

    if (
      /für\s+wohnzimmer|for\s+living\s+room\b|\bwohnzimmer\b|\bliving\s+room\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "living_room");
    }

    if (
      /für\s+schlafzimmer|for\s+bedroom\b|\bschlafzimmer\b|\bbedroom\b/.test(
        normalized
      )
    ) {
      addAttribute(productId, "room", "bedroom");
    }
  }

  /**
   * Hilfsfunktion: Erkennt Produkt-Familien
   */
  function detectFamily(text: string, productId: string): void {
    const normalized = normalizeText(text);

    if (/duschgel|shower\s+gel|dusch\s+gel/.test(normalized)) {
      addAttribute(productId, "family", "shower_gel");
    }

    if (/shampoo|shamp\b/.test(normalized)) {
      addAttribute(productId, "family", "shampoo");
    }

    if (/hoodie|hoody/.test(normalized)) {
      addAttribute(productId, "family", "hoodie");
    }

    if (/reiniger|cleaner|reinigungs|cleaning/.test(normalized)) {
      addAttribute(productId, "family", "cleaner");
    }

    if (/tücher|tuecher|tuch|wipes/.test(normalized)) {
      addAttribute(productId, "family", "wipes");
    }

    if (/\bspray\b/.test(normalized)) {
      addAttribute(productId, "family", "spray");
    }

    if (/creme|cream|lotion/.test(normalized)) {
      addAttribute(productId, "family", "cream");
    }

    if (/\böl\b|\boil\b/.test(normalized)) {
      addAttribute(productId, "family", "oil");
    }

    if (/seife|soap/.test(normalized)) {
      addAttribute(productId, "family", "soap");
    }

    // NEU: Napf/Fressnapf als eigene Familie "bowl"
    if (/napf|fressnapf|futternapf/.test(normalized)) {
      addAttribute(productId, "family", "bowl");
    }
  }

  // Haupt-Loop: Durch alle Produkte iterieren
  for (const product of allProducts) {
    const productId = product.id;

    const tagsText =
      Array.isArray((product as any).tags)
        ? (product as any).tags.join(" ")
        : typeof (product as any).tags === "string"
        ? (product as any).tags
        : "";

    const aggregatedText = normalizeText(
      [
        product.title,
        product.description || "",
        product.category || "",
        tagsText,
      ].join(" ")
    );

    detectSkinType(aggregatedText, productId);
    detectAudience(aggregatedText, productId);
    detectPet(aggregatedText, productId);
    detectRoom(aggregatedText, productId);
    detectFamily(aggregatedText, productId);
  }

  const vocabulary: ShopAttributeVocabulary[] = Array.from(
    vocabMap.entries()
  ).map(([key, data]) => ({
    key,
    values: Array.from(data.values).sort(),
    examples: data.examples.slice(0, 3),
    usageCount: data.usageCount,
  }));

  vocabulary.sort((a, b) => b.usageCount - a.usageCount);

  return {
    perProduct,
    vocabulary,
  };
}

/**
 * Query in Produktkern und Attribute aufteilen
 */
type ParsedQuery = {
  coreTerms: string[];              // Produktbegriffe (duschgel, hoodie, tuch, reiniger …)
  attributeTerms: string[];         // Begriffe/Phrasen, die wie Bedingungen klingen (trockene, haut, herren, vegan …)
  attributeFilters: ProductAttributeMap; // strukturierte Filter, z. B. { skin_type: ["dry"], audience: ["men"] }
};

function parseQueryForAttributes(text: string): ParsedQuery {
  const normalized = normalizeText(text);

  const stopwords = [
    "für",
    "mit",
    "und",
    "oder",
    "in",
    "auf",
    "zum",
    "zur",
    "der",
    "die",
    "das",
    "den",
    "dem",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "eines",
  ];

  // 2-Wort-Phrasen erkennen
  const attributePhrases = [
    "trockene haut",
    "empfindliche haut",
    "sensible haut",
    "trockene haare",
    "für herren",
    "für damen",
    "für kinder",
    "für männer",
    "für frauen",
    "für bad",
    "für küche",
    "für wohnung",
    "für haustiere",
    "für hunde",
    "für katzen",
  ];

  const foundPhrases: string[] = [];
  let remainingText = normalized;

  // Phrasen extrahieren
  for (const phrase of attributePhrases) {
    if (remainingText.includes(phrase)) {
      foundPhrases.push(phrase);
      // Phrase aus Text entfernen, um Doppelzählung zu vermeiden
      remainingText = remainingText.replace(phrase, " ");
    }
  }

  // Einzelwörter aus dem verbleibenden Text
  const remainingTokens = remainingText
    .split(" ")
    .filter((t) => t.length >= 3 && !stopwords.includes(t));

  // Attribute-Terms: Phrasen + einzelne Wörter, die typischerweise Attribute sind
  const attributeKeywords = [
    "trockene",
    "empfindliche",
    "sensible",
    "herren",
    "damen",
    "kinder",
    "männer",
    "frauen",
    "vegan",
    "bio",
    "organic",
    "xxl",
    "xl",
    "l",
    "m",
    "s",
    "haut",
    "haare",
    "bad",
    "küche",
    "wohnung",
  ];

  const attributeTerms: string[] = [...foundPhrases];
  const coreTerms: string[] = [];

  for (const token of remainingTokens) {
    if (
      attributeKeywords.includes(token) ||
      foundPhrases.some((p) => p.includes(token))
    ) {
      if (!attributeTerms.includes(token)) {
        attributeTerms.push(token);
      }
    } else {
      coreTerms.push(token);
    }
  }

  // NEU: Strukturierte Attribute-Filter aufbauen
  const attributeFilters: ProductAttributeMap = {};

  /**
   * Hilfsfunktion: Fügt einen Filter-Wert hinzu
   */
  function addFilter(key: string, value: string): void {
    if (!attributeFilters[key]) {
      attributeFilters[key] = [];
    }
    if (!attributeFilters[key].includes(value)) {
      attributeFilters[key].push(value);
    }
  }

  // skin_type Erkennung
  if (
    /trockenhaut|trockene\s+haut|trockener\s+haut|dry\s+skin/.test(normalized)
  ) {
    addFilter("skin_type", "dry");
  }
  if (
    /empfindliche\s+haut|empfindlicher\s+haut|empfindlich|sensible\s+haut|sensibler\s+haut|sensitive\s+skin/.test(
      normalized
    )
  ) {
    addFilter("skin_type", "sensitive");
  }
  if (
    /fettige\s+haut|fettiger\s+haut|fettig|oily\s+skin/.test(normalized)
  ) {
    addFilter("skin_type", "oily");
  }
  if (/mischhaut|combination\s+skin/.test(normalized)) {
    addFilter("skin_type", "combination");
  }
  if (
    /reife\s+haut|reifer\s+haut|reif|mature\s+skin|anti-?aging|anti\s+aging/.test(
      normalized
    )
  ) {
    addFilter("skin_type", "mature");
  }

  // Anti-Aging wird wie "reife Haut" behandelt
  if (/anti-aging|anti aging|antiaging|anti age/.test(normalized)) {
    addFilter("skin_type", "mature");
  }

  // audience Erkennung
  if (
    /für\s+herren|für\s+männer|for\s+men\b|herren\b|männer\b|\bmen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "men");
  }
  if (
    /für\s+damen|für\s+frauen|for\s+women\b|damen\b|frauen\b|\bwomen\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "women");
  }
  if (
    /für\s+kinder|for\s+kids\b|\bkinder\b|\bkids\b|\bchildren\b|für\s+jungs|für\s+mädchen/.test(
      normalized
    )
  ) {
    addFilter("audience", "kids");
  }
  if (
    /für\s+babys|für\s+babies|for\s+baby\b|\bbaby\b|\bbabies\b/.test(
      normalized
    )
  ) {
    addFilter("audience", "baby");
  }
  if (/unisex\b|für\s+alle|for\s+all\b/.test(normalized)) {
    addFilter("audience", "unisex");
  }

  // pet Erkennung
  if (
    /für\s+hunde|hund\b|\bhunde\b|for\s+dog\b|\bdog\b|\bdogs\b|\bwelpe\b|\bpuppy\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "dog");
  }
  if (
    /für\s+katzen|katze\b|\bkatzen\b|for\s+cat\b|\bcat\b|\bcats\b|\bkitten\b/.test(
      normalized
    )
  ) {
    addFilter("pet", "cat");
  }
  // Allgemein Haustier (nur wenn nicht bereits dog oder cat gesetzt)
  if (
    !attributeFilters.pet &&
    /haustier|haustiere|\bpet\b|\bpets\b|für\s+tiere/.test(normalized)
  ) {
    addFilter("pet", "pet");
  }

  // room Erkennung
  if (
    /für\s+bad|für\s+badezimmer|\bbad\b|\bbadezimmer\b|for\s+bathroom\b|\bbathroom\b|\bbath\b/.test(
      normalized
    )
  ) {
    addFilter("room", "bathroom");
  }
  if (
    /für\s+küche|für\s+kueche|\bküche\b|\bkueche\b|for\s+kitchen\b|\bkitchen\b/.test(
      normalized
    )
  ) {
    addFilter("room", "kitchen");
  }
  if (
    /für\s+wohnzimmer|\bwohnzimmer\b|for\s+living\s+room\b|\bliving\s+room\b/.test(
      normalized
    )
  ) {
    addFilter("room", "living_room");
  }
  if (
    /für\s+schlafzimmer|\bschlafzimmer\b|for\s+bedroom\b|\bbedroom\b/.test(
      normalized
    )
  ) {
    addFilter("room", "bedroom");
  }

  // family Erkennung
  if (/duschgel|shower\s+gel|dusch\s+gel/.test(normalized)) {
    addFilter("family", "shower_gel");
  }
  if (/shampoo|shamp\b/.test(normalized)) {
    addFilter("family", "shampoo");
  }
  if (/hoodie|hoody/.test(normalized)) {
    addFilter("family", "hoodie");
  }
  if (/reiniger|cleaner|reinigungs|cleaning|schmutz|verschmutz|verschmutzungen|fleck|flecken|kalk/.test(normalized)) {
    addFilter("family", "cleaner");
  }
  if (/tücher|tuecher|tuch|wipes/.test(normalized)) {
    addFilter("family", "wipes");
  }
  if (/\bspray\b/.test(normalized)) {
    addFilter("family", "spray");
  }
  if (/creme|cream|lotion/.test(normalized)) {
    addFilter("family", "cream");
  }
  if (/\böl\b|\boil\b/.test(normalized)) {
    addFilter("family", "oil");
  }
  if (/seife|soap/.test(normalized)) {
    addFilter("family", "soap");
  }

  return {
    coreTerms,
    attributeTerms,
    attributeFilters,
  };
}

/**
 * Erweitert Wörter um Katalog-Keywords, wenn sie als Komposita erkannt werden.
 * 
 * Beispiel: "fressnapf" → ["fressnapf", "napf"] (wenn "napf" im Katalog vorkommt)
 * 
 * @param words Array von normalisierten User-Wörtern
 * @param catalogKeywords Array von bekannten Katalog-Keywords
 * @returns Erweiterte Liste von Wörtern (inkl. Originale + aufgebrochene Komposita)
 */
function expandWordsWithCatalogKeywords(
  words: string[],
  catalogKeywords: string[]
): string[] {
  const result = new Set<string>();
  const keywordSet = new Set(
    catalogKeywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length >= 3)
  );

  for (const w of words) {
    const lower = w.toLowerCase().trim();
    if (!lower) continue;

    // Original-Wort immer behalten
    result.add(lower);

    // Heuristik: wenn das Wort mit einem bekannten Keyword endet,
    // z. B. "fressnapf" -> "napf", dann dieses Keyword zusätzlich übernehmen.
    for (const kw of keywordSet) {
      if (lower !== kw && lower.endsWith(kw)) {
        result.add(kw);
      }
    }
  }

  const expanded = Array.from(result);
  console.log("[EFRO CompoundSplit]", { words, expanded });
  return expanded;
}

/**
 * Identifiziert unbekannte Begriffe im User-Text und löst sie auf bekannte Keywords auf.
 * 
 * Verwendet eine Alias-Map für AI-generierte Mappings und zusätzlich Substring-Heuristiken
 * als Fallback.
 * 
 * @param text Der ursprüngliche User-Text
 * @param knownKeywords Array von bekannten Keywords (aus Katalog + erweiterte User-Wörter)
 * @param aliasMap Alias-Map mit Mappings von unbekannten Begriffen zu bekannten Keywords
 * @returns Objekt mit unbekannten Begriffen und aufgelösten Begriffen
 */
type UnknownTermsResult = {
  rawTerms: string[];
  normalizedTerms: string[];
  unknownTerms: string[];
  resolved: string[];
  aliasMapUsed: boolean;
};

function resolveUnknownTerms(
  text: string,
  knownKeywords: string[],
  aliasMap: AliasMap
): UnknownTermsResult {
  // Token-Extraktion: Gleiche Logik wie in filterProducts
  const normalizedText = normalizeText(text || "");
  const rawTerms = normalizedText
    .split(/[^a-z0-9äöüß]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  // WICHTIG: Nur normalizeAliasKey verwenden für Konsistenz
  const normalizedTerms = rawTerms
    .map((t) => normalizeAliasKey(t))
    .filter((t) => t.length > 0);

  // Known-Set mit normalizeAliasKey erstellen
  const knownSet = new Set(
    (knownKeywords || [])
      .map((kw) => normalizeAliasKey(kw))
      .filter((kw) => kw.length > 0)
  );

  // Unbekannte Begriffe identifizieren
  const unknownTermsSet = new Set<string>();
  const aliasResolvedSet = new Set<string>();
  const substringResolvedSet = new Set<string>();
  let aliasMapUsed = false;

  // Schritt 1: Alias-Map-Lookup
  for (const term of normalizedTerms) {
    if (!knownSet.has(term)) {
      unknownTermsSet.add(term);

      // Alias-Lookup mit normalisiertem Key
      const aliases = (aliasMap && aliasMap[term]) || [];

      if (aliases && aliases.length > 0) {
        aliasMapUsed = true;

        for (const alias of aliases) {
          const normalizedAlias = normalizeAliasKey(alias);

          if (normalizedAlias.length > 0) {
            // Nur Aliase hinzufügen, die auch in knownSet enthalten sind
            // (damit wir keine Phantom-Wörter haben, die im Katalog gar nicht vorkommen)
            if (knownSet.has(normalizedAlias)) {
              aliasResolvedSet.add(normalizedAlias);
            }
          }
        }
      }
    }
  }

  // Schritt 2: Substring-Heuristik als Fallback, NUR wenn Alias nichts geliefert hat
  if (!aliasMapUsed && unknownTermsSet.size > 0 && knownSet.size > 0) {
    for (const unknown of unknownTermsSet) {
      for (const kw of knownSet) {
        if (
          kw.length >= 3 &&
          kw !== unknown &&
          (unknown.includes(kw) || kw.includes(unknown))
        ) {
          substringResolvedSet.add(kw);
        }
      }
    }
  }

  // Schritt 3: Resolved-Tokens zusammenführen
  // Wenn Alias-Treffer vorhanden, verwende diese (optional plus Substring, aber Alias hat Priorität)
  const resolvedSet = new Set<string>();
  if (aliasResolvedSet.size > 0) {
    // Alias-Tokens haben Priorität
    aliasResolvedSet.forEach((t) => resolvedSet.add(t));
    // Optional: Substring-Tokens auch hinzufügen (falls gewünscht)
    // substringResolvedSet.forEach((t) => resolvedSet.add(t));
  } else if (substringResolvedSet.size > 0) {
    // Nur Substring-Tokens, wenn kein Alias-Treffer
    substringResolvedSet.forEach((t) => resolvedSet.add(t));
  }

  const uniqUnknown = Array.from(unknownTermsSet);
  const uniqResolved = Array.from(resolvedSet);

  console.log("[EFRO UnknownTermsResolved]", {
    text,
    rawTerms,
    normalizedTerms,
    unknownTerms: uniqUnknown,
    resolved: uniqResolved,
    aliasResolved: Array.from(aliasResolvedSet),
    substringResolved: Array.from(substringResolvedSet),
    knownKeywordsCount: knownKeywords.length,
    aliasMapUsed,
    aliasMapKeys: aliasMap ? Object.keys(aliasMap).slice(0, 10) : [],
    lookupKey: uniqUnknown.length > 0 ? normalizeAliasKey(uniqUnknown[0]) : null,
    lookupResult: uniqUnknown.length > 0 ? aliasMap?.[normalizeAliasKey(uniqUnknown[0])] : null,
  });

  return {
    rawTerms,
    normalizedTerms,
    unknownTerms: uniqUnknown,
    resolved: uniqResolved,
    aliasMapUsed,
  };
}

/**
 * Produkt-Scoring für Keywords
 */
function scoreProductForWords(product: EfroProduct, words: string[]): number {
  if (words.length === 0) return 0;

  const title = normalize(product.title);
  const desc = normalize(product.description || "");
  const category = normalize(product.category || "");

  // Tags robust behandeln (Array oder String)
  const rawTags: any = (product as any).tags;
  let tagsText = "";
  if (Array.isArray(rawTags)) {
    tagsText = rawTags.map((tag) => normalize(String(tag))).join(" ");
  } else if (typeof rawTags === "string") {
    tagsText = normalize(rawTags);
  }

  const blob = `${title} ${desc} ${category} ${tagsText}`;

  let score = 0;

  for (const word of words) {
    if (!word) continue;

    // Exakte Treffer – stärker gewichten
    if (title.includes(word)) {
      score += 5;
    } else if (tagsText.includes(word)) {
      score += 4;
    } else if (category.includes(word)) {
      score += 3;
    } else if (desc.includes(word)) {
      score += 2;
    }

    // NEU: robustes Fuzzy-Matching mit mehreren Präfixen (z. B. "dusch", "duschg")
    if (word.length >= 4) {
      const maxLen = Math.min(6, word.length);
      for (let len = 4; len <= maxLen; len++) {
        const prefix = word.slice(0, len);
        if (blob.includes(prefix)) {
          score += 1;
          break;
        }
      }
    }
  }

  return score;
}

/**
 * Produkte nach Keywords, Kategorie und Preis filtern
 * – NIE wieder [] zurückgeben, solange allProducts nicht leer ist.
 */
function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[]
): EfroProduct[] {
  console.log("[EFRO Filter ENTER]", { text, intent });

  // Intent kann innerhalb der Funktion angepasst werden
  let currentIntent: ShoppingIntent = intent;

  const t = normalize(text);

  // Dynamischen Attribut-Index für alle Produkte bauen
  const attributeIndex = buildAttributeIndex(allProducts);

  if (allProducts.length === 0) {
    console.log("[EFRO Filter RESULT]", {
      text,
      intent: currentIntent,
      resultTitles: [],
    });
    return [];
  }

  const { minPrice: userMinPrice, maxPrice: userMaxPrice } =
    extractUserPriceRange(text);
  console.log("[EFRO Filter PRICE]", { text, userMinPrice, userMaxPrice });

  let candidates = [...allProducts];

  /**
   * 1) Kategorie-Erkennung
   */
  const allCategories = Array.from(
    new Set(
      allProducts
        .map((p) => normalize(p.category || ""))
        .filter((c) => c.length >= 3)
    )
  );

  const categoryHintsInText: string[] = [];
  const matchedCategories: string[] = [];

  const catRegex = /kategorie\s+([a-zäöüß]+)/;
  const catMatch = t.match(catRegex);
  if (catMatch && catMatch[1]) {
    const catWord = catMatch[1];
    categoryHintsInText.push(catWord);
    allCategories.forEach((cat) => {
      if (cat.includes(catWord)) {
        matchedCategories.push(cat);
      }
    });
  } else {
    allCategories.forEach((cat) => {
      if (cat && t.includes(cat)) {
        matchedCategories.push(cat);
        categoryHintsInText.push(cat);
      }
    });
  }

  if (matchedCategories.length > 0) {
    candidates = candidates.filter((p) =>
      matchedCategories.includes(normalize(p.category || ""))
    );
  }

  console.log("[EFRO Filter CATEGORY]", {
    text,
    matchedCategories,
    categoryHintsInText,
    candidateCountAfterCategory: candidates.length,
  });

  /**
   * 2) Generische Keyword-Suche
   */
  const intentWords = [
    // Meta-/Preis-/Intent-Wörter
    "premium",
    "beste",
    "hochwertig",
    "qualitaet",
    "qualitat",
    "luxus",
    "teuer",
    "teure",
    "teuren",
    "teuerste",
    "teuersten",
    "billig",
    "guenstig",
    "günstig",
    "günstige",
    "günstigsten",
    "günstigste",
    "discount",
    "spar",
    "rabatt",
    "preis",
    "preise",
    "preiswert",
    "preiswerte",
    "deal",
    "bargain",

    // Geschenk-/Bundle-Intents
    "geschenk",
    "gift",
    "praesent",
    "praes",
    "present",
    "bundle",
    "set",
    "paket",
    "combo",

    // generische Produktwörter (keine echten Produkte)
    "produkte",
    "produkt",
    "artikel",
    "artikeln",
    "ware",
    "waren",
    "sachen",
    "dinge",
    "items",
    "item",
    "premium-produkte",
    "premium-produkt",
    "premiumprodukte",
    "premiumprodukt",
    "luxusprodukt",
    "luxusprodukte",
    "teuerster",

    // Preis-Wörter
    "unter",
    "ueber",
    "über",
    "bis",
    "maximal",
    "mindestens",
    "höchstens",
    "hoechstens",
    "weniger",
    "mehr",
    "zwischen",
    "euro",
    "eur",

    // Füllwörter / Stopwörter
    "zeig",
    "zeige",
    "zeigst",
    "mir",
    "was",
    "hast",
    "habe",
    "du",
    "gibt",
    "es",
    "inspiration",
    "suche",
    "suchen",
    "ich",
    "brauche",
    "bitte",
    "danke",
    "dankeschoen",
    "dankeschön",
    "meine",
    "deine",
    "und",
    "oder",
    "die",
    "der",
    "das",
    "den",
  ];

  let words: string[] = t
    .split(/[^a-z0-9äöüß]+/i)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !intentWords.includes(w));

  // reine Zahlen nicht als Keyword benutzen
  words = words.filter((w) => !/^\d+$/.test(w));

  // Katalog-Keywords aus allen Produkten extrahieren
  const catalogKeywordsSet = new Set<string>();
  for (const product of allProducts) {
    // Titel normalisieren und splitten
    const titleWords = normalizeText(product.title || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    titleWords.forEach((w) => catalogKeywordsSet.add(w));

    // Beschreibung normalisieren und splitten
    const descWords = normalizeText(product.description || "")
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    descWords.forEach((w) => catalogKeywordsSet.add(w));

    // Tags normalisieren und splitten
    const rawTags = (product as any).tags;
    if (Array.isArray(rawTags)) {
      rawTags.forEach((tag: string) => {
        const tagWords = normalizeText(String(tag))
          .split(/\s+/)
          .filter((w) => w.length >= 3);
        tagWords.forEach((w) => catalogKeywordsSet.add(w));
      });
    } else if (typeof rawTags === "string") {
      const tagWords = normalizeText(rawTags)
        .split(/\s+/)
        .filter((w) => w.length >= 3);
      tagWords.forEach((w) => catalogKeywordsSet.add(w));
    }
  }
  const catalogKeywords = Array.from(catalogKeywordsSet);

  // Alias-Map initialisieren und filtern (nur Keywords, die im Katalog vorkommen)
  const aliasMap = initializeAliasMap(catalogKeywords);

  // Wörter mit Katalog-Keywords erweitern (Komposita aufbrechen)
  let expandedWords = expandWordsWithCatalogKeywords(words, catalogKeywords);

  console.log("[EFRO Filter WORDS]", {
    text,
    words: expandedWords,
    categoryHintsInText,
  });

  // Intent-Fix: "Zeige mir X" mit konkretem Produkt → quick_buy statt explore
  const lowered = t.toLowerCase();
  const wordCount = words.length;

  const startsWithShowMe =
    lowered.startsWith("zeige mir ") ||
    lowered.startsWith("zeig mir ") ||
    lowered.startsWith("show me ");

  if (currentIntent === "explore" && startsWithShowMe && wordCount > 0 && wordCount <= 4) {
    currentIntent = "quick_buy";
    console.log("[EFRO IntentFix] Upgraded explore -> quick_buy for 'zeige mir' pattern", {
      text,
      words,
      wordCount,
    });
  }

  // --- EFRO Alias-Preprocessing -----------------------------------------
  // Alias-Map VOR dem Keyword-Matching anwenden, damit unbekannte Begriffe
  // (z. B. "fressnapf") in bekannte Keywords (z. B. "hunde", "napfset") aufgelöst werden
  // WICHTIG: Nur catalogKeywords übergeben, NICHT words/expandedWords,
  // damit User-Wörter wie "fressnapf" als unknownTerm erkannt werden
  const aliasResult = resolveUnknownTerms(text, catalogKeywords, aliasMap);

  // Speichere aliasResult für späteren Hard-Filter
  const unknownResult = aliasResult;

  if (aliasResult.resolved.length > 0) {
    const wordsBefore = [...words];
    const expandedBefore = [...expandedWords];
    const resolvedSet = new Set(aliasResult.resolved);

    // Wenn aliasMapUsed === true, verwende nur die Alias-resolved Tokens
    if (aliasResult.aliasMapUsed && aliasResult.resolved.length > 0) {
      const aliasResolved = aliasResult.resolved;
      const effectiveWordsSet = new Set<string>([
        ...words,
        ...aliasResolved,
      ]);

      words = Array.from(effectiveWordsSet);
      expandedWords = Array.from(effectiveWordsSet);
    } else {
      // Fallback: Normale Erweiterung
      const updatedWords = Array.from(
        new Set([
          ...words,
          ...resolvedSet,
        ])
      );

      const updatedExpandedWords = Array.from(
        new Set([
          ...(expandedWords || []),
          ...resolvedSet,
        ])
      );

      words = updatedWords;
      expandedWords = updatedExpandedWords;
    }

    console.log("[EFRO AliasPreApplied]", {
      text,
      unknownTerms: aliasResult.unknownTerms,
      resolved: aliasResult.resolved,
      aliasMapUsed: aliasResult.aliasMapUsed,
      wordsBefore,
      expandedBefore,
      wordsAfter: words,
      expandedAfter: expandedWords,
    });
  }
  // --- Ende EFRO Alias-Preprocessing ------------------------------------

  const hasBudget = userMinPrice !== null || userMaxPrice !== null;

  // Query in Core- und Attribute-Terms aufteilen
  const parsed = parseQueryForAttributes(text);
  const { coreTerms, attributeTerms, attributeFilters } = parsed;

  console.log("[EFRO Filter ATTR_FILTERS]", {
    text,
    attributeFilters,
  });

  // Strukturierte Attribute-Filter aus der Query anwenden (sofern vorhanden)
  const activeAttributeFilterEntries = Object.entries(attributeFilters).filter(
    ([, values]) => Array.isArray(values) && values.length > 0
  );

  let candidatesAfterAttr = candidates;

  if (activeAttributeFilterEntries.length > 0) {
    const beforeAttrFilterCount = candidates.length;

    // Spezieller Fall: menschliche Haut-Typen, aber keine Tier-Anfrage
    if (
      attributeFilters.skin_type &&
      attributeFilters.skin_type.length > 0 &&
      (!attributeFilters.pet || attributeFilters.pet.length === 0)
    ) {
      candidatesAfterAttr = candidatesAfterAttr.filter((p) => {
        const cat = normalize(p.category || "");
        return HUMAN_SKIN_CATEGORIES.some((allowed) => cat.includes(allowed));
      });
    }

    const filteredByAttributes = candidatesAfterAttr.filter((product) => {
      const productAttrs: ProductAttributeMap =
        attributeIndex.perProduct[product.id] ?? {};

      // Alle aktiven Filter müssen matchen
      return activeAttributeFilterEntries.every(([key, values]) => {
        const prodValues = productAttrs[key] ?? [];

        if (!Array.isArray(prodValues) || prodValues.length === 0) {
          return false;
        }

        // Speziallogik für Haustiere (pet = dog/cat/pet)
        if (key === "pet") {
          const hasGeneric = prodValues.includes("pet");
          const hasDog = prodValues.includes("dog");
          const hasCat = prodValues.includes("cat");

          const wantsGeneric = values.includes("pet");
          const wantsDog = values.includes("dog");
          const wantsCat = values.includes("cat");

          // Direktes Matching (dog↔dog, cat↔cat, pet↔pet)
          const directMatch = values.some((v) => prodValues.includes(v));

          // Query: "Haustiere" (pet) → akzeptiere dog oder cat
          const genericMatchesSpecies = wantsGeneric && (hasDog || hasCat);

          // Query: "Hund(e)" bzw. "Katze(n)" → akzeptiere generische Haustier-Produkte (pet)
          const speciesMatchesGeneric =
            (wantsDog || wantsCat) && hasGeneric;

          return directMatch || genericMatchesSpecies || speciesMatchesGeneric;
        }

        // Standardfall für alle anderen Attribute
        return values.some((v) => prodValues.includes(v));
      });
    });

    if (filteredByAttributes.length > 0) {
      console.log("[EFRO Filter ATTR_FILTER_APPLIED]", {
        text,
        attributeFilters,
        beforeAttrFilterCount,
        afterAttrFilterCount: filteredByAttributes.length,
      });
      candidates = filteredByAttributes;
    } else {
      console.log("[EFRO Filter ATTR_FILTER_NO_MATCH]", {
        text,
        attributeFilters,
        beforeAttrFilterCount,
      });
      // Kein harter Filter: wir behalten die ursprünglichen Kandidaten
    }
  }

  // --- EFRO Alias-Hard-Filter ------------------------------------------
  // Bei aliasMapUsed === true: Harte Filterung auf Produkte, die Alias-Tokens enthalten
  let productsForKeywordMatch = candidates;
  
  if (unknownResult.aliasMapUsed && unknownResult.resolved.length > 0) {
    const aliasTerms = new Set(unknownResult.resolved);

    const aliasCandidates = candidates.filter((p) => {
      const haystack = normalizeText(
        [
          p.title,
          p.description || "",
          p.category || "",
          Array.isArray((p as any).tags)
            ? (p as any).tags.join(" ")
            : typeof (p as any).tags === "string"
            ? (p as any).tags
            : "",
        ].join(" ")
      ).toLowerCase();

      for (const term of aliasTerms) {
        if (term && haystack.includes(term)) {
          return true;
        }
      }
      return false;
    });

    if (aliasCandidates.length > 0) {
      console.log("[EFRO AliasHardFilter]", {
        text,
        aliasTerms: Array.from(aliasTerms),
        beforeCount: candidates.length,
        afterCount: aliasCandidates.length,
        sampleTitles: aliasCandidates.slice(0, 5).map((p) => p.title),
      });
      productsForKeywordMatch = aliasCandidates;
    }
  }
  // --- Ende EFRO Alias-Hard-Filter --------------------------------------

  if (expandedWords.length > 0 || coreTerms.length > 0 || attributeTerms.length > 0) {
    // Für jedes Produkt einen searchText erstellen
    const candidatesWithScores = productsForKeywordMatch.map((p) => {
      const searchText = normalizeText(
        [
          p.title,
          p.description || "",
          p.category || "",
          Array.isArray((p as any).tags)
            ? (p as any).tags.join(" ")
            : typeof (p as any).tags === "string"
            ? (p as any).tags
            : "",
        ].join(" ")
      );

      // Core-Match: Mindestens 1 coreTerm oder expandedWord muss vorkommen
      // (erweiterte Wörter werden auch für Core-Matching verwendet)
      const hasCoreMatch =
        (coreTerms.length === 0 && expandedWords.length === 0) ||
        coreTerms.some((term) => searchText.includes(term)) ||
        expandedWords.some((word) => searchText.includes(word));

      if (!hasCoreMatch && (coreTerms.length > 0 || expandedWords.length > 0)) {
        return { product: p, score: 0, attributeScore: 0 };
      }

      // Keyword-Score mit erweiterten Wörtern (inkl. aufgebrochene Komposita)
      const keywordScore = scoreProductForWords(p, expandedWords);

      // Attribute-Score: Zähle, wie viele attributeTerms im Text vorkommen
      let attributeScore = 0;
      for (const attr of attributeTerms) {
        if (searchText.includes(attr)) {
          attributeScore += 1;
        }
      }

      // Strukturierte Attribute-Score: basiert auf attributeFilters + AttributeIndex
      let structuredAttributeScore = 0;
      const productAttrs: ProductAttributeMap =
        attributeIndex.perProduct[p.id] ?? {};

      for (const [key, values] of Object.entries(attributeFilters)) {
        const prodValues = productAttrs[key] ?? [];

        if (!Array.isArray(prodValues) || prodValues.length === 0) continue;

        if (values.some((v) => prodValues.includes(v))) {
          // Jeder passende strukturierte Filter gibt einen extra Bonus
          structuredAttributeScore += 2;
        }
      }

      // Gesamt-Score: Keywords + Text-Attribute + strukturierte Attribute
      let totalScore =
        keywordScore + attributeScore * 2 + structuredAttributeScore * 3;

      // Spezielle Ranking-Regel für "Schimmel": Bevorzuge Reiniger/Sprays, benachteilige Tücher
      // Testfälle:
      // - "Es soll Schimmel entfernen." → Reiniger/Sprays vor Tüchern
      // - "Ich brauche etwas gegen Schimmel im Bad." → Reiniger/Sprays vor Tüchern
      // - "Hast du einen Schimmelentferner für die Dusche?" → Reiniger/Sprays vor Tüchern
      const normalizedUserText = t;
      if (normalizedUserText.includes("schimmel")) {
        const normalizedTitle = normalize(p.title);
        const normalizedDescription = normalize(p.description || "");
        const hasSchimmelInProduct =
          normalizedTitle.includes("schimmel") ||
          normalizedDescription.includes("schimmel");

        if (hasSchimmelInProduct) {
          const scoreBefore = totalScore;
          const productFamily = productAttrs.family || [];
          // normalizedTitle ist bereits lowercase durch normalize()

          // Bonus für Reiniger/Sprays mit Schimmel-Bezug
          if (
            productFamily.includes("cleaner") ||
            normalizedTitle.includes("reiniger") ||
            normalizedTitle.includes("spray") ||
            normalizedTitle.includes("schimmelentferner") ||
            normalizedTitle.includes("anti-schimmel")
          ) {
            totalScore += 3;
          }

          // Malus für Tücher/Wipes mit Schimmel-Bezug (damit sie nachrangig erscheinen)
          if (
            productFamily.includes("wipes") ||
            normalizedTitle.includes("tuch") ||
            normalizedTitle.includes("tücher") ||
            normalizedTitle.includes("tuecher") ||
            normalizedTitle.includes("wipes")
          ) {
            totalScore -= 1;
          }

          // Debug-Log nur im Schimmel-Fall
          if (scoreBefore !== totalScore) {
            console.log("[EFRO SchimmelRanking]", {
              userText: normalizedUserText,
              appliedMoldBoost: true,
              productId: p.id,
              title: p.title,
              family: productFamily,
              scoreBefore,
              scoreAfter: totalScore,
            });
          }
        }
      }

      return { product: p, score: totalScore, attributeScore };
    });

    // Filtere Kandidaten mit Score > 0
    const scored = candidatesWithScores.filter((entry) => entry.score > 0);

    if (scored.length > 0) {
      // Sortiere nach: attributeScore (absteigend), dann totalScore, dann Preis
      scored.sort((a, b) => {
        if (b.attributeScore !== a.attributeScore) {
          return b.attributeScore - a.attributeScore;
        }
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Preis-Sortierung je nach Intent
  if (currentIntent === "premium") {
          return (b.product.price ?? 0) - (a.product.price ?? 0);
  } else if (currentIntent === "bargain") {
          return (a.product.price ?? 0) - (b.product.price ?? 0);
        }
        return 0;
      });

      candidates = scored.map((e) => e.product);

      if (candidates.length > 20) {
        candidates = candidates.slice(0, 20);
      }

      console.log("[EFRO Filter KEYWORD_MATCHES]", {
        text,
        words: expandedWords,
        coreTerms,
        attributeTerms,
        aliasMapUsed: unknownResult.aliasMapUsed,
        candidatesCount: productsForKeywordMatch.length,
        matchedTitles: candidates.slice(0, 10).map((p) => p.title),
      });
  } else {
      console.log("[EFRO Filter NO_KEYWORD_MATCH]", {
        text,
        intent: currentIntent,
        words: expandedWords,
        coreTerms,
        attributeTerms,
        note: "Alias-Preprocessing wurde bereits vor dem Keyword-Matching angewendet",
      });
    }
  }

  /**
   * 3) Intent-/Preis-Logik
   */
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  if (userMinPrice !== null || userMaxPrice !== null) {
    // User-Budget hat immer Vorrang
    minPrice = userMinPrice;
    maxPrice = userMaxPrice;
  } else {
    // NEU: keine harten Standard-Preisgrenzen mehr.
    // Premium/Bargain/Gift steuern nur die Sortierung (siehe unten).
    minPrice = null;
    maxPrice = null;
  }

  if (minPrice !== null || maxPrice !== null) {
      candidates = candidates.filter((p) => {
      const price = p.price ?? 0;
      if (minPrice !== null && price < minPrice) return false;
      if (maxPrice !== null && price > maxPrice) return false;
      return true;
    });
  }

  console.log("[EFRO Filter FALLBACK_INTENT]", {
    text,
    intent,
    candidateTitles: candidates.map((p) => p.title),
    minPrice,
    maxPrice,
    userMinPrice,
    userMaxPrice,
  });

  /**
   * 4) Fallback, wenn durch Filter alles weggefallen ist
   */
      if (candidates.length === 0) {
        candidates = [...allProducts];

    if (matchedCategories.length > 0) {
      const byCat = candidates.filter((p) =>
        matchedCategories.includes(normalize(p.category || ""))
      );
      if (byCat.length > 0) {
        candidates = byCat;
      }
    }

    if (userMinPrice !== null || userMaxPrice !== null) {
      let tmp = candidates.filter((p) => {
        const price = p.price ?? 0;
        if (userMinPrice !== null && price < userMinPrice) return false;
        if (userMaxPrice !== null && price > userMaxPrice) return false;
        return true;
      });

      if (tmp.length > 0) {
        candidates = tmp;
      }
    }
  }

  /**
   * 5) Sortierung abhängig von Budget & Intent
   */

  if (hasBudget) {
    if (userMinPrice !== null && userMaxPrice === null) {
      // nur Untergrenze: günstigste über X zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      // unter / zwischen X: teuer nach günstig
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
  } else {
    if (currentIntent === "premium") {
      // Premium: teuerste zuerst
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (
      currentIntent === "bargain" ||
      currentIntent === "gift" ||
      currentIntent === "quick_buy"
    ) {
      // Schnäppchen / Geschenk / Quick-Buy: günstigste zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (currentIntent === "explore") {
      candidates.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  console.log("[EFRO Filter RESULT]", {
    text,
    intent: currentIntent,
    resultTitles: candidates.slice(0, 4).map((p) => p.title),
  });

  return candidates.slice(0, 4);
}

/**
 * Ausschnitt aus der Produktbeschreibung
 */
function getDescriptionSnippet(
  description?: string | null,
  maxLength: number = 280
): string | null {
  if (!description) return null;

  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return null;

  if (clean.length <= maxLength) {
    return clean;
  }

  return clean.slice(0, maxLength) + "…";
}

/**
 * Reply-Text für EFRO bauen
 */
function buildReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[]
): string {
  const count = recommended.length;

  if (count === 0) {
    return (
      "Ich habe in den aktuellen Shop-Daten leider kein Produkt gefunden, das genau zu deiner Anfrage passt. " +
      "Wenn du mir deinen Wunsch etwas anders beschreibst – zum Beispiel Kategorie oder Budget – probiere ich es gerne direkt noch einmal."
    );
  }

  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "–";

  const first = recommended[0];

  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== null || maxPrice !== null;

  const explanationMode = detectExplanationMode(text);

  // Attribute-Terms aus Query extrahieren
  const parsed = parseQueryForAttributes(text);
  const { attributeTerms } = parsed;

  const descSnippet = getDescriptionSnippet(first.description);
  const hasDesc = !!descSnippet;

  let budgetText = "";
  if (hasBudget) {
    if (minPrice !== null && maxPrice === null) {
      budgetText = `ab etwa ${minPrice} €`;
    } else if (maxPrice !== null && minPrice === null) {
      budgetText = `bis etwa ${maxPrice} €`;
    } else if (minPrice !== null && maxPrice !== null) {
      budgetText = `zwischen ${minPrice} € und ${maxPrice} €`;
    }
  }

  const categoryLabel =
    first.category && first.category.trim().length > 0
      ? first.category
      : "dieses Produkts";
  const priceLabel = formatPrice(first);

  // 0) Spezialfälle: Erklär-Modus
  if (explanationMode) {
    if (explanationMode === "ingredients") {
      if (hasDesc) {
        return (
          `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
          "Die exakte Liste der Inhaltsstoffe wird direkt im Shop auf der Produktseite gepflegt – dort findest du alle Details, inklusive gesetzlich vorgeschriebener Angaben.\n\n" +
          "In der aktuellen Produktbeschreibung steht unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Wenn du Allergien oder sehr empfindliche Haut hast, schau bitte auf der Produktseite im Bereich 'Inhaltsstoffe' nach oder kontaktiere direkt den Händler, bevor du das Produkt verwendest."
        );
      } else {
        return (
          `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
          "Die exakte Liste der Inhaltsstoffe wird direkt im Shop auf der Produktseite gepflegt – dort findest du alle Details, inklusive gesetzlich vorgeschriebener Angaben.\n\n" +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}" und liegt preislich bei ${priceLabel}. ` +
          "Wenn du Allergien oder sehr empfindliche Haut hast, schau bitte auf der Produktseite im Bereich 'Inhaltsstoffe' nach oder kontaktiere direkt den Händler, bevor du das Produkt verwendest."
        );
      }
    }

        if (explanationMode === "materials") {
      if (hasDesc) {
        return (
          `Du möchtest mehr über das Material von "${first.title}" wissen.\n\n` +
          "Die genaue Materialzusammensetzung (z. B. Baumwolle, Polyester, Mischgewebe) ist im Shop auf der Produktseite hinterlegt – dort findest du in der Regel einen Abschnitt wie 'Material' oder 'Produktdetails'.\n\n" +
          "In der aktuellen Produktbeschreibung findest du unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Für exakte Materialangaben und Prozentanteile nutze bitte die Produktseite."
        );
      } else {
        return (
          `Du möchtest mehr über das Material von "${first.title}" wissen.\n\n` +
          "Die genaue Materialzusammensetzung (z. B. Baumwolle, Polyester, Mischgewebe) ist im Shop auf der Produktseite hinterlegt – dort findest du in der Regel einen Abschnitt wie 'Material' oder 'Produktdetails'.\n\n" +
          `EFRO kann dir sagen: Es handelt sich um einen Artikel aus der Kategorie "${categoryLabel}" im Preisbereich ${priceLabel}. ` +
          "Für exakte Materialangaben und Prozentanteile nutze bitte die Produktseite."
        );
      }
    }


    if (explanationMode === "usage") {
      if (hasDesc) {
        return (
          `Du möchtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}". Die konkrete Anwendung wird normalerweise auf der Produktverpackung und auf der Produktseite im Shop beschrieben.\n\n` +
          "In der Produktbeschreibung steht zum Gebrauch unter anderem:\n" +
          descSnippet +
          "\n\n" +
          "Weitere Details und Sicherheitshinweise findest du auf der Produktseite im Shop."
        );
      } else {
        return (
          `Du möchtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
          `Dieses Produkt gehört zur Kategorie "${categoryLabel}". Die konkrete Anwendung wird normalerweise auf der Produktverpackung und auf der Produktseite im Shop beschrieben.\n\n` +
          "Schau dir am besten die Hinweise zur Anwendung und Sicherheit auf der Produktseite an – dort findest du meist eine Schritt-für-Schritt-Erklärung. Wenn du mir sagst, wofür du es genau einsetzen willst, kann ich dir zusätzlich einen Tipp geben, worauf du besonders achten solltest."
        );
      }
    }

    if (explanationMode === "care" || explanationMode === "washing") {
      if (hasDesc) {
        return (
          `Du fragst nach Pflege- oder Waschhinweisen für "${first.title}".\n\n` +
          `Als Artikel aus der Kategorie "${categoryLabel}" gelten in der Regel die Pflegehinweise, die auf dem Etikett bzw. auf der Produktseite stehen. Dort findest du zum Beispiel Symbole zu Waschtemperatur, Trockner-Eignung oder Handwäsche.\n\n` +
          "In der Produktbeschreibung sind Pflegehinweise erwähnt, z. B.:\n" +
          descSnippet +
          "\n\n" +
          "Bitte richte dich bei der Pflege immer nach den offiziellen Angaben auf dem Produktlabel bzw. in der Produktbeschreibung im Shop."
        );
      } else {
        return (
          `Du fragst nach Pflege- oder Waschhinweisen für "${first.title}".\n\n` +
          `Als Artikel aus der Kategorie "${categoryLabel}" gelten in der Regel die Pflegehinweise, die auf dem Etikett bzw. auf der Produktseite stehen. Dort findest du zum Beispiel Symbole zu Waschtemperatur, Trockner-Eignung oder Handwäsche.\n\n` +
          "Bitte richte dich bei der Pflege immer nach den offiziellen Angaben auf dem Produktlabel bzw. in der Produktbeschreibung im Shop."
        );
      }
    }
  }

  /**
   * 1) Fälle mit explizitem Budget im Text
   */
  if (hasBudget) {
    if (count === 1) {
      return (
        `Ich habe ein Produkt gefunden, das gut zu deinem Budget ${budgetText} passt:\n\n` +
        `• ${first.title} – ${formatPrice(first)}\n\n` +
        "Wenn du möchtest, kann ich dir noch eine Alternative im ähnlichen Preisbereich zeigen."
      );
    }

    const intro =
      `Ich habe mehrere Produkte passend zu deinem Budget ${budgetText} gefunden.\n` +
      `Ein sehr gutes Match ist:\n\n` +
      `• ${first.title} – ${formatPrice(first)}\n\n` +
      "Zusätzlich habe ich dir unten noch weitere passende Produkte eingeblendet:";

  const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );

    const closing =
      "\n\nWenn du dein Budget anpassen möchtest (zum Beispiel etwas höher oder niedriger), sag mir einfach kurz Bescheid.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 2) Premium-Intent ohne Budget
   */
  if (intent === "premium") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint =
        ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const qualityHint =
      " Ich habe Produkte ausgewählt, bei denen Qualität im Vordergrund steht.";

    if (count === 1) {
      return (
        "Ich habe ein hochwertiges Premium-Produkt für dich gefunden:\n\n" +
        `• ${first.title}\n\n` +
        (attributeHint || qualityHint) +
        " Das ist eine sehr gute Wahl, wenn dir Qualität wichtiger ist als der letzte Euro im Preis. " +
        "Wenn du möchtest, kann ich dir noch eine etwas günstigere Alternative zeigen."
      );
    }

    const intro =
      "Ich habe dir eine Auswahl an hochwertigen Premium-Produkten zusammengestellt." +
      (attributeHint || qualityHint) +
      " Ein besonders starkes Match ist:";

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      '\n\nWenn du lieber in einem bestimmten Preisbereich bleiben möchtest, sag mir einfach dein Budget (z. B. "unter 500 Euro").';

    return [intro, "", `• ${first.title}`, "", ...lines, closing].join("\n");
  }

  /**
   * 3) Bargain-Intent ohne Budget
   */
  if (intent === "bargain") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const priceHint =
      " Ich habe auf ein gutes Preis-Leistungs-Verhältnis geachtet.";

    const intro =
      "Ich habe dir besonders preiswerte Produkte herausgesucht." +
      (attributeHint || priceHint);
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      "\n\nWenn du mir dein maximales Budget nennst, kann ich noch genauer eingrenzen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 4) Geschenk-Intent
   */
  if (intent === "gift") {
    const intro =
      "Ich habe dir ein paar passende Geschenkideen zusammengestellt:";
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      "\n\nSag mir gerne, für wen das Geschenk ist – dann kann ich noch gezielter empfehlen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 5) Standard-Fälle (explore / quick_buy / bundle ...)
   */
  if (count === 1) {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    return (
      "Ich habe ein passendes Produkt für dich gefunden:\n\n" +
      `• ${first.title}${attributeHint}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  let attributeHint = "";
  if (attributeTerms.length > 0) {
    attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
  }

  const intro =
    "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:" +
    attributeHint;
  const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
  const closing =
    "\n\nWenn du möchtest, helfe ich dir jetzt beim Eingrenzen – zum Beispiel nach Preisbereich, Kategorie oder Einsatzzweck.";

  return [intro, "", ...lines, closing].join("\n");
}

/**
 * Hauptfunktion, die vom Chat/Avatar aufgerufen wird
 */
export function runSellerBrain(
  userText: string,
  currentIntent: ShoppingIntent,
  allProducts: EfroProduct[],
  plan?: string,
  previousRecommended?: EfroProduct[]
): SellerBrainResult {
  const raw = userText ?? "";
  const cleaned = raw.trim();

  const nextIntent = detectIntentFromText(cleaned, currentIntent);

  // Plan-Logik: starter = 2, pro = 4, enterprise = 6, default = 4
  const getMaxRecommendationsForPlan = (p?: string): number => {
    const normalized = (p ?? "").toLowerCase();
    if (normalized === "starter") return 2;
    if (normalized === "pro") return 4;
    if (normalized === "enterprise") return 6;
    return 4;
  };

  const maxRecommendations = getMaxRecommendationsForPlan(plan);

  const explanationMode = detectExplanationMode(cleaned);
  console.log("[EFRO SellerBrain] explanationMode", {
    text: cleaned,
    explanationMode,
    previousCount: previousRecommended ? previousRecommended.length : 0,
  });

  // Erklärung zuerst, aber ohne neue Produktauswahl
  if (explanationMode) {
    const recommended = previousRecommended
      ? previousRecommended.slice(0, maxRecommendations)
      : [];

    const replyText =
      recommended.length > 0
        ? buildReplyText(cleaned, nextIntent, recommended)
        : "Ich kann dir gerne Fragen zu Inhaltsstoffen, Anwendung oder Pflege beantworten. " +
          "Dafür brauche ich aber ein konkretes Produkt. Bitte sage mir zuerst, welches Produkt dich interessiert, " +
          "dann kann ich dir die Details dazu erklären.";

    console.log("[EFRO SellerBrain] Explanation mode – no new filtering", {
      text: cleaned,
      explanationMode,
      previousCount: previousRecommended ? previousRecommended.length : 0,
      usedCount: recommended.length,
      maxRecommendations,
    });

  return {
    intent: nextIntent,
    recommended,
    replyText,
  };
  }

  // OFF-TOPIC-GUARD
  if (!isProductRelated(cleaned)) {
    const recommended = previousRecommended
      ? previousRecommended.slice(0, maxRecommendations)
      : [];

    const offTopicReply =
      "Ich bin hier, um dir bei der Produktsuche zu helfen. Stell mir bitte Fragen zu Produkten aus dem Shop.";

    console.log("[EFRO SellerBrain] Off-topic detected, no new filtering", {
      text: cleaned,
      previousCount: previousRecommended ? previousRecommended.length : 0,
      usedCount: recommended.length,
    });

    return {
      intent: nextIntent,
      recommended,
      replyText: offTopicReply,
    };
  }

  // Normale Such-/Kaufanfrage -> filtern
  const filterResult = filterProducts(cleaned, nextIntent, allProducts);
  const candidateCount = filterResult.length;
  
  // NEU: Schimmel-Only-Filter
  const moldQuery = isMoldQuery(cleaned);
  let finalRanked = filterResult;
  
  if (moldQuery) {
    const moldOnly = filterResult.filter((p) => isMoldProduct(p));
    
    if (moldOnly.length > 0) {
      finalRanked = moldOnly;
      
      console.log("[EFRO MoldOnly Filter]", {
        userText: cleaned,
        moldCount: moldOnly.length,
        titles: moldOnly.map((p) => p.title),
      });
    }
  }
  
  // Bei Schimmel-Anfragen maximal 1 Produkt zeigen (Hero-Produkt)
  const effectiveMaxRecommendations = moldQuery
    ? Math.min(1, maxRecommendations ?? 1)
    : maxRecommendations;
  
  let recommended = finalRanked.slice(0, effectiveMaxRecommendations);

  // Force-Show-Logik: Bei klaren Produktanfragen immer Produkte anzeigen
  const forceShowProducts =
    nextIntent === "quick_buy" &&
    isProductRelated(cleaned) &&
    candidateCount > 0;

  let reusedPreviousProducts = false;

  const normalized = normalize(cleaned || "");

  const offTopicKeywords = [
    "politik",
    "wahl",
    "regierung",
    "krieg",
    "nachrichten",
    "cursor",
    "token",
    "ki",
    "chatgpt",
    "abo",
    "abonnement",
    "vertrag",
    "versicherung",
  ];

  const isOffTopic = offTopicKeywords.some((word) =>
    normalized.includes(word)
  );

  let replyText: string;

  if (isOffTopic) {
    // Nur leeren, wenn nicht forceShowProducts aktiv ist
    if (!forceShowProducts) {
      recommended = [];
    }
    replyText =
      "Ich bin EFRO und helfe dir nur bei Fragen zu Produkten aus diesem Shop. " +
      "Frag mich z. B. nach Kategorien, Preisen, Größen, Materialien oder bestimmten Artikeln – " +
      "dann zeige ich dir passende Produkte.";
  } else {
    replyText = buildReplyText(cleaned, nextIntent, recommended);
  }

  // Force-Show-Logik nach allen Guards: Wenn Produkte gefunden wurden, aber recommended leer ist
  if (forceShowProducts && recommended.length === 0 && candidateCount > 0) {
    recommended = finalRanked.slice(0, effectiveMaxRecommendations);
    console.log("[EFRO SellerBrain FORCE_PRODUCTS]", {
      text: cleaned,
      intent: nextIntent,
      candidateCount,
      usedCount: recommended.length,
    });
    // Reply-Text neu generieren, wenn noch nicht gesetzt
    if (!replyText || replyText.includes("helfe dir nur")) {
      replyText = buildReplyText(cleaned, nextIntent, recommended);
    }
  }

  console.log("[EFRO SellerBrain]", {
    userText: cleaned,
    queryText: cleaned,
    intent: nextIntent,
    plan,
    maxRecommendations,
    recCount: recommended.length,
    usedSourceCount: allProducts.length,
    explanationMode: explanationMode ?? null,
    reusedPreviousProducts,
  });

  return {
    intent: nextIntent,
    recommended,
    replyText,
  };
}

// ------------------------------------------------------
// Spezialisierte Logik für Schimmel-Anfragen
// ------------------------------------------------------

function isMoldQuery(text: string): boolean {
  const t = (text || "").toLowerCase();
  // Typische deutsche Formulierungen für Schimmel
  return (
    t.includes("schimmel") ||
    t.includes("schimmelentferner") ||
    t.includes("schimmel-reiniger") ||
    t.includes("schimmelreiniger")
  );
}

function isMoldProduct(product: EfroProduct): boolean {
  const parts: string[] = [];

  if (product.title) parts.push(String(product.title));
  if (product.description) parts.push(String(product.description));
  if (product.category) parts.push(String(product.category));

  const rawTags = (product as any).tags;
  if (Array.isArray(rawTags)) {
    parts.push(rawTags.map((t) => String(t)).join(" "));
  } else if (typeof rawTags === "string") {
    parts.push(rawTags);
  }

  const full = parts.join(" ").toLowerCase();

  return (
    full.includes("schimmel") ||
    full.includes("schimmelentferner") ||
    full.includes("schimmel-reiniger") ||
    full.includes("schimmelreiniger") ||
    full.includes("mold")
  );
}

