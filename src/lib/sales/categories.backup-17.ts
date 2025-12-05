/**
 * EFRO Kategorien-Modul
 *
 * Aktuell: Enthält Helper für spezielle Kategorien wie Parfüm & Schimmel.
 * Ziel:
 *  - isPerfumeProduct: Erkennung von echten Parfüm-Produkten (kein Duschgel, keine Duftkerzen, keine Deko)
 *  - isMoldProduct: Erkennung von Schimmel-spezifischen Produkten (Reiniger, Entferner etc.)
 *
 * WICHTIG:
 *  - Dieses Modul wird von sellerBrain.ts verwendet.
 *  - Verhalten wird gezielt verbessert, ohne sellerBrain.ts anzufassen.
 */

import { EfroProduct } from "@/lib/products/mockCatalog";
import { MOLD_KEYWORDS, PERFUME_SYNONYMS } from "./languageRules.de";

/**
 * Kleiner Normalizer – analog zu sellerBrain.ts/budget.ts.
 * Wird nur innerhalb dieses Moduls verwendet.
 */
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(text: string): string {
  return normalizeText(text);
}

/**
 * Prüft, ob ein Produkt ein echtes Parfüm-Produkt ist
 * (basierend auf Kategorie, Titel, Beschreibung, Tags)
 *
 * Ziel:
 *  - Nur "echte" Parfüms/Fragrances erkennen
 *  - Keine Deko-/Duftkerzen, Raumdüfte, Reiniger etc.
 *
 * Diese Funktion wird von sellerBrain.ts verwendet, wenn der User explizit Parfüm anfragt.
 */
export function isPerfumeProduct(product: EfroProduct): boolean {
  const title = normalize(product.title || "");
  const description = normalize(product.description || "");
  const category = normalize(product.category || "");

  // Tags defensiv in ein string[] verwandeln
  const rawTags = Array.isArray(product.tags)
    ? product.tags
    : typeof product.tags === "string"
    ? [product.tags]
    : [];

  const tagsText = normalize(rawTags.join(" "));

  // Volltext für Keyword-Checks
  const full = `${category} ${title} ${description} ${tagsText}`.trim();

  // Basis-Keywords für "echtes" Parfüm
  const basePerfumeKeywords: string[] = [
    "parfum",
    "parfums",
    "parfüm",
    "parfuem",
    "perfume",
    "perfumes",
    "duft",
    "duefte",
    "düfte",
    "fragrance",
    "fragrances",
  ];

  // Stärkere Text-Phrasen (typische Parfüm-Begriffe)
  const strongPerfumePhrases: string[] = [
    "eau de parfum",
    "eau de toilette",
    "eau de cologne",
    "eau de fraiche",
  ];

  // Synonyme aus languageRules.de.ts (falls gepflegt)
  const synonymPerfumeKeywords: string[] = Array.isArray(PERFUME_SYNONYMS)
    ? PERFUME_SYNONYMS.map((s) => s.toLowerCase())
    : [];

  // NEGATIVE Keywords:
  //  - sollen alles rausfiltern, was eher Duschgel, Bodylotion, Kerze, Raumduft etc. ist
  const negativeKeywords: string[] = [
    "duschgel",
    "dusch gel",
    "shower gel",
    "shampoo",
    "conditioner",
    "body wash",
    "body lotion",
    "lotion",
    "creme",
    "cream",
    "handcreme",
    "hand cream",
    "reinigung",
    "reiniger",
    "haarspray",
    "raumduft",
    "raum duft",
    "duftkerze",
    "duft kerze",
    "kerze",
    "kerzen",
    "candle",
    "candles",
    "deko",
    "dekoration",
    "diffuser",
    "öl",
    "oel",
    "massageöl",
    "massage oel",
    "bad",
    "badezusatz",
    "badesalz",
    "deo",
    "deodorant",
    "face wash",
    "gesichtsreinigung",
  ];

  // Kategorie-Negativliste: Kategorien, die fast sicher KEIN Parfüm sind
  const negativeCategoryHints: string[] = [
    "deko",
    "dekoration",
    "haushalt",
    "haushaltswaren",
    "garten",
    "beleuchtung",
    "kerzen",
    "candle",
    "reiniger",
    "reinigung",
  ];

  // POSITIVE Checks
  const hasStrongPhrase = strongPerfumePhrases.some((p) => full.includes(p));
  const hasBaseKeyword =
    basePerfumeKeywords.some((kw) => full.includes(kw)) ||
    synonymPerfumeKeywords.some((kw) => full.includes(kw));

  // NEGATIVE Checks
  const hasNegative = negativeKeywords.some((kw) => full.includes(kw));
  const categoryClearlyNegative = negativeCategoryHints.some((kw) =>
    category.includes(kw)
  );

  // Sicherheitsnetz:
  //  - Wenn Kategorie explizit "parfum / perfume / duft" enthält, ist das ein starkes Signal.
  const categoryPerfumeHints: string[] = [
    "parfum",
    "parfüm",
    "parfuem",
    "perfume",
    "duft",
    "fragrance",
  ];
  const categoryLooksLikePerfume = categoryPerfumeHints.some((kw) =>
    category.includes(kw)
  );

  // Entscheidungslogik:
  // 1) Wenn Kategorie eindeutig Parfüm & keine harten Negativ-Signale -> JA.
  if (categoryLooksLikePerfume && !hasNegative && !categoryClearlyNegative) {
    return true;
  }

  // 2) Wenn starke Parfüm-Phrasen im Text und keine harten Negativ-Signale -> JA.
  if (hasStrongPhrase && !hasNegative && !categoryClearlyNegative) {
    return true;
  }

  // 3) Wenn Basis-Keywords UND mindestens ein Parfüm-Synonym, aber keine Negativsignale -> JA.
  if (hasBaseKeyword && !hasNegative && !categoryClearlyNegative) {
    return true;
  }

  // In allen anderen Fällen: eher KEIN echtes Parfüm
  return false;
}

/**
 * Prüft, ob ein Produkt ein Schimmel-Produkt ist (Schimmelreiniger etc.).
 * 1:1-Funktionalität zu sellerBrain.ts, nur ins Modul ausgelagert.
 */
export function isMoldProduct(product: EfroProduct): boolean {
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

  // Importiert aus languageRules.de.ts
  return MOLD_KEYWORDS.some((kw) => full.includes(kw));
}
