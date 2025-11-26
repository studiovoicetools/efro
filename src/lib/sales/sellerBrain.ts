// src/lib/sales/sellerBrain.ts

import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";

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
 * Nutzertext normalisieren
 */
function normalize(text: string): string {
  return text.toLowerCase();
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

  // Material / Stoff / aus welchem Material
  if (
    t.includes("material") ||
    t.includes("stoff") ||
    t.includes("welches material") ||
    t.includes("woraus ist") ||
    t.includes("aus welchem stoff")
  ) {
    return "materials";
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

  // Pflege / waschen
  if (
    t.includes("wie kann ich das waschen") ||
    t.includes("wie kann ich das reinigen") ||
    t.includes("wie wasche ich das") ||
    t.includes("waschhinweis") ||
    t.includes("pflegehinweis") ||
    t.includes("pflege") ||
    t.includes("waschen")
  ) {
    return "washing";
  }

  // Allgemeine Pflege-Fragen (ohne explizites "waschen")
  if (
    t.includes("wie pflege ich") ||
    t.includes("pflegeanleitung") ||
    t.includes("pflege tipps") ||
    t.includes("pflegetipps")
  ) {
    return "care";
  }

  return null;
}

/**
 * Prüft, ob der Text produktbezogen ist
 */
function isProductRelated(text: string): boolean {
  const t = normalize(text || "");

  // Wörter, die auf typische Produkt-/Shopfragen hindeuten
  const productHints = [
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
  ];

  return productHints.some((w) => t.includes(w));
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

  // Wenn nichts erkannt wird: alten Intent behalten,
  // ansonsten auf quick_buy zurückfallen.
  return currentIntent || "quick_buy";
}

/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 * Beispiele:
 *  - "unter 50 euro"         -> maxPrice = 50
 *  - "bis 30 €"              -> maxPrice = 30
 *  - "über 100 euro"         -> minPrice = 100
 *  - "mindestens 200€"       -> minPrice = 200
 *  - "zwischen 30 und 50 €"  -> min=30, max=50
 *  - "von 30 bis 50 €"       -> min=30, max=50
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

  // Text vor der Zahl anschauen, um "unter", "bis", "über", "mindestens" etc. zu finden
  const prefix = t.slice(0, priceMatch.index ?? 0);

  const hasUnder =
    /unter|bis|höchstens|hoechstens|maximal|weniger als/.test(prefix);
  const hasOver = /über|ueber|mindestens|ab|mehr als/.test(prefix);

  if (hasUnder && !hasOver) {
    maxPrice = value; // z.B. "unter 50 Euro"
  } else if (hasOver && !hasUnder) {
    minPrice = value; // z.B. "über 100 Euro"
  } else {
    // Falls weder noch eindeutig ist: nur maxPrice setzen,
    // z.B. "Geschenk 50 Euro" -> wir interpretieren das als Budget-Obergrenze
    maxPrice = value;
  }

  return { minPrice, maxPrice };
}

/**
 * Produkt-Scoring für Keywords
 */
function scoreProductForWords(product: EfroProduct, words: string[]): number {
  if (words.length === 0) return 0;

  const title = normalize(product.title);
  const desc = normalize(product.description || "");
  const category = normalize(product.category || "");

  // Tags robust behandeln (Array oder String), damit es keine .map-Fehler gibt
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

    const core =
      word.length >= 8
        ? word.slice(0, 7)
        : word.length >= 6
        ? word.slice(0, 6)
        : word.length >= 4
        ? word.slice(0, 4)
        : word;

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

    // Fuzzy-Treffer
    if (core.length >= 3 && blob.includes(core)) {
      score += 1;
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

  const t = normalize(text);

  if (allProducts.length === 0) {
    console.log("[EFRO Filter RESULT]", {
      text,
      intent,
      resultTitles: [],
    });
    return [];
  }

  // 0) Preisbereich erkennen (inkl. "zwischen 30 und 50 Euro")
  const { minPrice: userMinPrice, maxPrice: userMaxPrice } =
    extractUserPriceRange(text);
  console.log("[EFRO Filter PRICE]", { text, userMinPrice, userMaxPrice });

  let candidates = [...allProducts];

  /**
   * 1) Kategorie-Erkennung (Haushalt, Haustier, Kosmetik, Deko, ...)
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

  // Variante A: "kategorie haushalt"
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
    // Variante B: Text enthält direkt den Kategorienamen
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

    // Preis-Wörter (sollen NICHT als Keyword übrig bleiben)
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

    // Füllwörter / einfache Stopwörter (verkürzt)
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

  // GANZ WICHTIG:
  // Reine Zahlen wie "100" NICHT als Keywords benutzen,
  // sonst matchen wir "100-teilig" statt den Preisbereich zu nutzen.
  words = words.filter((w) => !/^\d+$/.test(w));

  console.log("[EFRO Filter WORDS]", {
    text,
    words,
    categoryHintsInText,
  });

  const hasBudget = userMinPrice !== null || userMaxPrice !== null;

  // 2a) Keyword-Scoring nur dann, wenn wirklich sinnvolle Wörter da sind
  if (words.length > 0) {
    const scored = candidates
      .map((p) => ({
        product: p,
        score: scoreProductForWords(p, words),
      }))
      .filter((entry) => entry.score > 0);

    if (scored.length > 0) {
      scored.sort((a, b) => b.score - a.score);
      candidates = scored.map((e) => e.product);

      // Long Tail einkürzen, aber nicht zu hart
      if (candidates.length > 20) {
        candidates = candidates.slice(0, 20);
      }

      console.log("[EFRO Filter KEYWORD_MATCHES]", {
        text,
        words,
        matchedTitles: candidates.map((p) => p.title),
      });
    } else {
      console.log("[EFRO Filter NO_KEYWORD_MATCH]", {
        text,
        intent,
        words,
      });
      // -> candidates bleiben wie sie sind (nur Kategorie-Filter)
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
    // Standardbereiche pro Intent (wie vorher)
    if (intent === "premium") {
      minPrice = 600;
    } else if (intent === "bargain") {
      maxPrice = 400;
    } else if (intent === "gift") {
      minPrice = 300;
      maxPrice = 700;
    }
  }

  // Preisfilter anwenden, falls gesetzt
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
   *    -> nie [] zurückgeben, solange allProducts nicht leer ist.
   */
  if (candidates.length === 0) {
    // Basis: kompletter Katalog
    candidates = [...allProducts];

    // Kategorie-Fallback: Kategorie beibehalten, Budget lockern
    if (matchedCategories.length > 0) {
      const byCat = candidates.filter((p) =>
        matchedCategories.includes(normalize(p.category || ""))
      );
      if (byCat.length > 0) {
        candidates = byCat;
      }
    }

    // Wenn der User ein Budget genannt hat, versuchen wir es "weich":
    if (userMinPrice !== null || userMaxPrice !== null) {
      const tmp = candidates.filter((p) => {
        const price = p.price ?? 0;
        if (userMinPrice !== null && price < userMinPrice) return false;
        if (userMaxPrice !== null && price > userMaxPrice) return false;
        return true;
      });

      // Wenn selbst das nichts bringt: Budget komplett ignorieren
      if (tmp.length > 0) {
        candidates = tmp;
      }
    }
  }

  /**
   * 5) Sortierung abhängig von Budget & Intent
   *
   * Logik:
   *  - explizites Budget:
   *      * nur minPrice (z.B. "über 100 €")  -> aufsteigend (günstigste über X zuerst)
   *      * maxPrice oder min+max (unter / zwischen) -> absteigend (teuer nach günstig)
   *  - kein Budget -> Intent-Logik wie vorher
   */

  if (hasBudget) {
    if (userMinPrice !== null && userMaxPrice === null) {
      // Nur Untergrenze: "über 100 Euro" -> zeige die günstigsten über 100 zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      // "unter X" oder "zwischen X und Y" -> teuer nach günstig
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }
  } else {
    // Kein explizites Budget -> Intent-Standardlogik
    if (intent === "premium") {
      // teuerste zuerst
      candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    } else if (
      intent === "bargain" ||
      intent === "gift" ||
      intent === "quick_buy"
    ) {
      // günstigste zuerst
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (intent === "explore") {
      // Explore: ohne Budget alphabetisch
      candidates.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  console.log("[EFRO Filter RESULT]", {
    text,
    intent,
    resultTitles: candidates.slice(0, 4).map((p) => p.title),
  });

  // Maximal 3–4 Vorschläge – Plan-Limit macht page.tsx
  return candidates.slice(0, 4);
}

/**
 * Extrahiert einen Ausschnitt aus der Produktbeschreibung
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

  // Budget aus dem Text holen
  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== null || maxPrice !== null;

  // Prüfen, ob der User eine Erklärung will (Inhaltsstoffe etc.)
  const explanationMode = detectExplanationMode(text);

  const descSnippet = getDescriptionSnippet(first.description);
  const hasDesc = !!descSnippet;

  // Hilfs-Label für Budget
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

  /**
   * 0) Spezialfälle: User will EXPLIZIT Erklärungen
   *    (Inhaltsstoffe, Material, Anwendung, Pflege).
   */
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
    if (count === 1) {
      return (
        "Ich habe ein hochwertiges Premium-Produkt für dich gefunden:\n\n" +
        `• ${first.title}\n\n` +
        "Das ist eine sehr gute Wahl, wenn dir Qualität wichtiger ist als der letzte Euro im Preis. " +
        "Wenn du möchtest, kann ich dir noch eine etwas günstigere Alternative zeigen."
      );
    }

    const intro =
      "Ich habe dir eine Auswahl an hochwertigen Premium-Produkten zusammengestellt. " +
      "Ein besonders starkes Match ist:";

    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title}`
    );

    const closing =
      '\n\nWenn du lieber in einem bestimmten Preisbereich bleiben möchtest, sag mir einfach dein Budget (z. B. "unter 500 Euro").';

    return [intro, "", `• ${first.title}`, "", ...lines, closing].join("\n");
  }

  /**
   * 3) Bargain-Intent ohne Budget
   */
  if (intent === "bargain") {
    const intro =
      "Ich habe dir besonders preiswerte Produkte mit gutem Preis-Leistungs-Verhältnis herausgesucht:";
    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title}`
    );
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
    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title}`
    );
    const closing =
      "\n\nSag mir gerne, für wen das Geschenk ist – dann kann ich noch gezielter empfehlen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 5) Standard-Fälle (explore / quick_buy / bundle ...)
   */
  if (count === 1) {
    return (
      "Ich habe ein passendes Produkt für dich gefunden:\n\n" +
      `• ${first.title}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  const intro =
    "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:";
  const lines = recommended.map(
    (p, idx) => `${idx + 1}. ${p.title}`
  );
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

  // Einfache Plan-Logik: starter = 2, pro = 4, enterprise = 6, default = 4
  const getMaxRecommendationsForPlan = (p?: string): number => {
    const normalizedPlan = (p ?? "").toLowerCase();
    if (normalizedPlan === "starter") return 2;
    if (normalizedPlan === "pro") return 4;
    if (normalizedPlan === "enterprise") return 6;
    return 4; // default
  };

  const maxRecommendations = getMaxRecommendationsForPlan(plan);

  // explanationMode EINMAL zentral am Anfang berechnen
  const explanationMode = detectExplanationMode(cleaned);
  console.log("[EFRO SellerBrain] explanationMode", {
    text: cleaned,
    explanationMode,
    previousCount: previousRecommended ? previousRecommended.length : 0,
  });

  // 1) EXPLANATION-GUARD (Hard-Fix): VOR ALLEN Filtern
  if (explanationMode) {
    // Wenn wir bereits empfohlene Produkte haben, nutzen wir GENAU diese weiter.
    // Wenn nicht, empfehlen wir GAR KEINE neuen Produkte.
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

  // OFF-TOPIC-GUARD: VOR allen Filtern
  if (!isProductRelated(cleaned)) {
    // Off-topic: keine neuen Produkte auf Basis der Frage auswählen
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

  // Normale Such-/Kaufanfrage -> ganz normal filtern
  let recommended = filterProducts(cleaned, nextIntent, allProducts).slice(
    0,
    maxRecommendations
  );

  // Erklär-Fragen: wenn es vorherige Empfehlungen gibt, diese "locken"
  let reusedPreviousProducts = false;

  // Off-Topic-Hardlimit: Nur über Produkte reden
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
    recommended = []; // keine Produkte anzeigen

    replyText =
      "Ich bin EFRO und helfe dir nur bei Fragen zu Produkten aus diesem Shop. " +
      "Frag mich z. B. nach Kategorien, Preisen, Größen, Materialien oder bestimmten Artikeln – " +
      "dann zeige ich dir passende Produkte.";
  } else {
    replyText = buildReplyText(cleaned, nextIntent, recommended);
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
