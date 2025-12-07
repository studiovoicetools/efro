/**
 * Sprach-Konfiguration für deutsche Budget- und Keyword-Erkennung
 * 
 * Diese Datei enthält Konstanten für:
 * - Budget-Range-Patterns (zwischen/von-bis)
 * - Budget-Min/Max-Wörter (über/unter/bis/etc.)
 * - Kategorie-Keywords
 * - Usage-Keywords
 * - Skin-Keywords
 */

// Budget-Bereich-Patterns (z. B. "zwischen 400 und 800")
export const BUDGET_RANGE_PATTERNS = [
  // "zwischen 400 und 800"
  /zwischen\s+(\d+)\s*(?:€|euro)?\s+und\s+(\d+)\s*(?:€|euro)?/i,
  // "von 400 bis 800"
  /von\s+(\d+)\s*(?:€|euro)?\s+bis\s+(\d+)\s*(?:€|euro)?/i,
  // "20 bis 30 Euro" oder "20 bis 30 €" (ohne "von")
  /(\d+)\s*(?:€|euro)?\s+bis\s+(\d+)\s*(?:€|euro)/i,
  // "400-800" oder "400 – 800"
  /(\d+)\s*[-–]\s*(\d+)/,
];

// Wörter, die eine Untergrenze (minPrice) anzeigen
// WICHTIG: "über" ist NICHT hier, da es im Deutschen Budget-Kontext als Obergrenze gelesen wird
export const BUDGET_MIN_WORDS = [
  "ab",
  "mindestens",
  "mind.",
];

// Wörter, die eine Obergrenze (maxPrice) anzeigen
// WICHTIG: "über" ist hier, da "Mein Budget ist über 600 Euro" als Obergrenze interpretiert wird
export const BUDGET_MAX_WORDS = [
  "über",
  "bis",
  "unter",
  "höchstens",
  "maximal",
  "max.",
  "weniger als"
];

// Wörter für Bereichsangaben (zwischen X und Y)
export const RANGE_BUDGET_WORDS = [
  "zwischen"
];

// Wörter, die eine ungefähre Angabe anzeigen (vorerst als Obergrenze behandelt)
export const BUDGET_AROUND_WORDS = [
  "um die",
  "circa",
  "ca.",
  "ungefähr",
  "so"
];

// Kategorie-Keywords: Mapping von Kategorie-Slug zu Suchbegriffen
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  // EFRO Category-Fix 2025-12-03: Elektronik & Mode allgemeiner abdecken
  elektronik: [
    "elektronik",
    "elektrische geräte",
    "elektrisches gerät",
    "smartphone",
    "smartphones",
    "handy",
    "handys",
    "phone",
    "phones",
    "telefon",
    "mobiltelefon",
    "mobiles gerät",
    "iphone",
    "android",
    "galaxy",
  ],
  mode: [
    "mode",
    "fashion",
    "kleidung",
    "bekleidung",
    "oberteil",
    "oberteile",
    "t-shirt",
    "tshirts",
    "shirt",
    "shirts",
    "pullover",
    "hoodie",
    "hoodies",
    "sweatshirt",
    "jacke",
    "jacken",
  ],
  // CLUSTER D FIX PROFI-01v1: "board" entfernt - zu mehrdeutig (kann Snowboard, Skateboard, Surfboard sein)
  snowboard: ["snowboard", "snowboards"],
  // EFRO Budget-Fix 2025-11-30: Bindungen als eigene Kategorie
  bindungen: ["bindungen", "bindung", "binding", "bindings", "snowboard-bindungen", "snowboard-bindung", "snowboardbindungen", "snowboardbindung"],
  haushalt: ["haushalt", "putzen", "reiniger", "reinigung", "küche", "bad", "wasserkocher", "electric kettle", "kettle", "haushaltsgeräte", "küchengerät", "haushaltsgerät", "kochendes wasser", "wasser erhitzen", "kocher"],
  pflege: ["pflege", "shampoo", "duschgel", "seife", "creme", "öl", "oel", "lotion"],
  tierbedarf: ["tier", "tierbedarf", "hund", "hunde", "welpe", "welpen", "katze", "katzen", "kater", "hündin", "futter", "leckerli", "haustier", "haustiere", "pets", "pet", "dog", "cat", "animal", "napf", "fressnapf"],
  perfume: ["perfume", "parfum", "parfüm", "duft", "eau de parfum", "eau de toilette"],
  // SCHRITT 3 FIX: Garten-Kategorie hinzugefügt für S10v1
  Garten: ["garten", "gartenartikel", "garten-artikel", "gartenbedarf", "gartenzubehör", "gartenzubehoer", "gartenprodukte"],
  // SCHRITT 5 FIX: Kosmetik und Werkzeug für globale Kategorien
  kosmetik: ["kosmetik", "beauty", "pflegeprodukte", "hautpflege"],
  werkzeug: ["werkzeug", "tools", "werkzeugkoffer"],
  // hier können später weitere Kategorien ergänzt werden
};

// Usage-Keywords: Verwendungszweck/Einsatzgebiet
export const USAGE_KEYWORDS: Record<string, string[]> = {
  reinigung: ["reiniger", "reinigung", "putzen", "säubern", "sauber machen", "entfernen"],
  spray: ["spray", "sprüh", "sprayen", "sprühflasche"],
  tabletten: ["tablette", "tabletten", "tabs", "kapseln"],
  shampoo: ["shampoo", "haarwäsche", "fellshampoo"],
  öl: ["öl", "oel"],
  pulver: ["pulver"],
  // ...
};

// Skin-Keywords: Hauttyp/Eigenschaften
export const SKIN_KEYWORDS: Record<string, string[]> = {
  trockeneHaut: ["trockene haut", "sehr trocken", "trockene hautstellen"],
  fettigeHaut: ["fettige haut", "ölige haut", "glänzende haut"],
  sensibleHaut: ["sensible haut", "sensitive haut", "empfindliche haut"],
  juckreiz: ["juckreiz", "jucken", "juckende haut"],
  allergie: ["allergie", "allergiker", "allergisch"],
};

// Budget-Wort-Erkennung (für "mein Budget ist...")
export const BUDGET_WORD_PATTERNS = [
  "mein budget",
  "ich habe ein budget",
  "ich habe budget",
  " budget ",
  "budget von",
  "budget liegt",
  "budget so bei",
  "budget bei",
];

// Intent-Wörter: Meta-/Preis-/Intent-Wörter für Keyword-Filterung
export const INTENT_WORDS = [
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

// Stopwörter für Query-Parsing (parseQueryForAttributes)
export const QUERY_STOPWORDS = [
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einen",
  "einem",
  "einer",
  "eines",
  "und",
  "oder",
  "aber",
  "mit",
  "ohne",
  "für",
  "von",
  "zu",
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

// Attribute-Phrasen (2-Wort-Phrasen)
export const ATTRIBUTE_PHRASES = [
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

// Attribute-Keywords (einzelne Wörter)
export const ATTRIBUTE_KEYWORDS = [
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

// Produkt-Hints (statische Hints für Produkt-Erkennung)
export const PRODUCT_HINTS = [
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
  // Haut-/Haar-Attribute
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

// Wörter, die KEIN Produktcode sind
export const NON_CODE_TERMS = [
  "zeige",
  "zeig",
  "mir",
  "bitte",
  "produkt",
  "produkte",
  "artikel",
  "code",
  "sku",
  "nummer",
  "num",
  "preis",
  "euro",
  "budget",
  // Personalpronomen
  "ich",
  "du",
  "er",
  "sie",
  "wir",
  "ihr",
  // Verben (haben)
  "habe",
  "hast",
  "hat",
  "haben",
  // Budget/Preis-Wörter
  "unter",
  "über",
  "bis",
  "ca",
  "etwa",
  "ungefähr",
  "von",
];

// Stopwörter für AI-Unknown-Terms-Filterung
export const UNKNOWN_AI_STOPWORDS = [
  // Pronomen / Hilfsverben
  "ich", "du", "er", "sie", "es", "wir", "ihr",
  "mein", "meine", "dein", "deine",
  "sein", "seine", "unser", "unsere", "euer", "eure",
  "habe", "hast", "hat", "haben", "bin", "bist", "ist", "sind", "war", "waren",
  // Füllwörter
  "naja", "äh", "also", "mal", "doch", "eben", "halt",
  // Budget-/Preiswörter
  "budget", "preis", "preise", "preisspanne", "euro",
  "unter", "über", "bis", "ca", "etwa", "ungefähr", "von",
];

// "Zeige mir"-Patterns
export const SHOW_ME_PATTERNS = [
  "zeige mir",
  "zeig mir",
  "zeig mal",
  "show me",
];

// Parfüm-Synonyme: Erkennung von Parfüm-Anfragen
export const PERFUME_SYNONYMS = [
  "parfum",
  "parfüm",
  "parfume",
  "perfüm",
];

// Premium-Tokens für Intent-Erkennung (inkl. Meta-Wörter)
export const PREMIUM_TOKENS = [
  "zeige",
  "zeig",
  "mir",
  "mich",
  "premium",
  "beste",
  "hochwertig",
  "luxus",
  "teuer",
  "teuerste",
  "teuersten",
  "teuerster",
];

// Explanation-Mode-Keywords: Erkennung von Erklärungsanfragen
export const EXPLANATION_MODE_KEYWORDS = {
  ingredients: [
    "inhaltsstoff",
    "inhaltsstoffe",
    "zutaten",
    "ingredients",
  ],
  usage: [
    "wie verwende ich",
    "wie benutze ich",
    "wie nutze ich",
    "wie wende ich",
    "anwendung",
    "schritt für schritt",
    "schritt-für-schritt",
  ],
  washing: [
    "wie kann ich das waschen",
    "wie kann ich das reinigen",
    "wie wasche ich das",
    "waschhinweis",
    "pflegehinweis",
  ],
};

// EFRO WAX-Disambiguierung: Keywords für Haarwachs vs. Snowboard-Wachs
export const WAX_HAIR_KEYWORDS = [
  "haare",
  "haar",
  "frisur",
  "frisör",
  "friseur",
  "styling",
  "pomade",
  "hair",
  "haarwachs",
  "haarstyling",
  "frisurprodukt",
  "frisurprodukte",
  "gelf",
  "gel",
  "wax für haare",
  "wax für die haare",
  "haarwax",
];

export const WAX_SNOWBOARD_KEYWORDS = [
  "snowboard",
  "snowboards",
  "ski",
  "skis",
  "belag",
  "board",
  "piste",
  "kanten",
  "wax für snowboard",
  "wax für ski",
  "ski wax",
  "snowboard wax",
  "skiwachs",
  "snowboardwachs",
  "winter",
  "sport",
  "accessory",
  "accessories",
];

// Kern-Produkt-Keywords: Wörter, die immer produktbezogen sind
export const CORE_PRODUCT_KEYWORDS = [
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
  // WICHTIG: "fressnapf" wurde entfernt - soll dynamisch über AI gelernt werden
  "napf",
  "futternapf",
  // CLUSTER 2 FIX: Bindungen als produktbezogen erkennen
  "bindungen",
  "bindung",
  "binding",
  "bindings",
  // CLUSTER K FIX: Smartphone- und Mode-Keywords als produktbezogen erkennen
  "smartphone",
  "smartphones",
  "handy",
  "handys",
  "jeans",
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
];

// Kontext-Keywords: "für die Küche", "fürs Bad", etc.
export const CONTEXT_KEYWORDS = [
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

// Premium-Wörter: Intent-Erkennung für Premium-Produkte
export const PREMIUM_WORDS = [
  "premium",
  "beste",
  "hochwertig",
  "qualitaet",
  "qualitat",
  "luxus",
  "teuer",
  "teuerste",
  "teuersten",
  "teuerster",
];

// Bargain-Wörter: Intent-Erkennung für günstige Produkte
export const BARGAIN_WORDS = [
  "billig",
  "billige",
  "billiger",
  "billiges",
  "billigste",
  "billigstes",
  "billigsten",
  "guenstig",
  "günstig",
  "günstige",
  "günstiger",
  "günstiges",
  "günstigste",
  "günstigstes",
  "günstigsten",
  "preiswert",
  "preiswerte",
  "preiswerter",
  "preiswertes",
  "preiswerteste",
  "preiswertestes",
  "discount",
  "spar",
  "rabatt",
  "deal",
  "bargain",
];

// Gift-Wörter: Intent-Erkennung für Geschenke
export const GIFT_WORDS = [
  "geschenk",
  "gift",
  "praesent",
  "praes",
  "present",
];

// Bundle-Wörter: Intent-Erkennung für Sets/Pakete
export const BUNDLE_WORDS = [
  "bundle",
  "set",
  "paket",
  "combo",
];

// Explore-Wörter: Intent-Erkennung für Erkundungsanfragen
export const EXPLORE_WORDS = [
  "zeig mir was",
  "inspiration",
  "zeige mir",
  "was hast du",
  "was gibt es",
];

// Most-Expensive-Patterns: Erkennung von "teuerstes Produkt"
export const MOST_EXPENSIVE_PATTERNS = [
  /\b(teuerste|teuersten|teuerster)\s+(produkt|produkte|artikel)\b/,
  /\b(premium|premium-)?(produkt|produkte|artikel)\s+mit\s+dem\s+(höchsten|höchste|höchster)\s+preis\b/i,
  /\b(höchsten|höchste|höchster)\s+preis\b/i,
  "most expensive",
];

// Schimmel-Keywords: Erkennung von Schimmel-Anfragen
export const MOLD_KEYWORDS = [
  "schimmel",
  "schimmelentferner",
  "schimmel-reiniger",
  "schimmelreiniger",
  "anti-schimmel",
  "mold",
];

// Schimmel-bezogene Produktwörter (für Scoring)
export const MOLD_PRODUCT_KEYWORDS = {
  cleaners: ["reiniger", "spray", "schimmelentferner", "anti-schimmel"],
  wipes: ["tuch", "tücher", "tuecher", "wipes"],
};

// Budget-Keywords für Szenario-Erkennung (detectProfisellerScenario)
export const BUDGET_KEYWORDS_FOR_SCENARIO = [
  "budget",
  "preis",
  "maximal",
  "max",
  "höchstens",
  "hoechstens",
  "unter",
  "bis",
  "ab",
  "über",
  "euro",
  "eur",
  "€",
];

// Kategorie-Keywords für Szenario-Erkennung
export const CATEGORY_KEYWORDS_FOR_SCENARIO = [
  "kategorie",
  "kategorien",
  "haushalt",
  "pflege",
  "tierbedarf",
  "kosmetik",
  "parfüm",
  "parfum",
];

// Produkt-Keywords für Budget-Only-Erkennung
export const PRODUCT_KEYWORDS_FOR_BUDGET_ONLY = [
  "shampoo",
  "duschgel",
  "reiniger",
  "spray",
  "lotion",
  "creme",
  "parfüm",
  "parfum",
  "haushalt",
  "pflege",
  "tierbedarf",
];

// Stopwörter für Budget-Only-Erkennung (sollen nicht als Produkt-Keywords zählen)
export const BUDGET_ONLY_STOPWORDS = [
  "zeige",
  "zeig",
  "mir",
  "bitte",
  "produkt",
  "produkte",
  "artikel",
  "kategorie",
  "marke",
  "brand",
];

// ====================================================================
// EFRO Dynamic Synonym Infrastructure
// ====================================================================
// Diese Infrastruktur ermöglicht es, Synonyme dynamisch zur Laufzeit
// hinzuzufügen (z. B. durch AI-Lernen), ohne LanguageRules zu ändern.

export type DynamicSynonymEntry = {
  term: string;              // z. B. ein vom Nutzer verwendeter Begriff
  canonicalCategory?: string; // z. B. "haustier" oder "pet"
  extraKeywords?: string[];   // z. B. ["napf", "napfset"]
  // EFRO: Erweitert für LanguageRule-Kompatibilität
  canonical?: string;        // z. B. "napf" (synonym zu canonicalCategory)
  keywords?: string[];       // Synonyme / Schlüsselwörter (synonym zu extraKeywords)
  categoryHints?: string[];  // Kategorie-Hints (z. B. ["pets", "dogs", "cats"])
};

const dynamicSynonyms: DynamicSynonymEntry[] = [];

/**
 * Registriert ein dynamisches Synonym zur Laufzeit
 * Wird typischerweise von der AI-Schicht aufgerufen, nachdem ein unbekannter Begriff
 * erfolgreich aufgelöst wurde.
 */
export function registerDynamicSynonym(entry: DynamicSynonymEntry) {
  const term = entry.term.toLowerCase().trim();
  if (!term) return;

  const existing = dynamicSynonyms.find(
    (e) => e.term.toLowerCase() === term
  );

  if (existing) {
    existing.canonicalCategory = entry.canonicalCategory ?? entry.canonical ?? existing.canonicalCategory;
    existing.canonical = entry.canonical ?? entry.canonicalCategory ?? existing.canonical;
    
    // Merge keywords
    if (entry.extraKeywords?.length || entry.keywords?.length) {
      const merged = new Set([
        ...(existing.extraKeywords ?? []),
        ...(existing.keywords ?? []),
        ...(entry.extraKeywords ?? []),
        ...(entry.keywords ?? []),
      ]);
      existing.extraKeywords = Array.from(merged);
      existing.keywords = Array.from(merged);
    }
    
    // Merge categoryHints
    if (entry.categoryHints?.length) {
      const merged = new Set([
        ...(existing.categoryHints ?? []),
        ...entry.categoryHints,
      ]);
      existing.categoryHints = Array.from(merged);
    }
  } else {
    dynamicSynonyms.push({
      term,
      canonicalCategory: entry.canonicalCategory ?? entry.canonical,
      canonical: entry.canonical ?? entry.canonicalCategory,
      extraKeywords: entry.extraKeywords ?? entry.keywords ?? [],
      keywords: entry.keywords ?? entry.extraKeywords ?? [],
      categoryHints: entry.categoryHints ?? [],
    });
  }
}

/**
 * Gibt alle registrierten dynamischen Synonyme zurück
 */
export function getDynamicSynonyms(): DynamicSynonymEntry[] {
  return dynamicSynonyms;
}

