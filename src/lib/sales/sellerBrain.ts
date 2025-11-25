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

/**
 * Optional: Tarif-Plan (Starter / Pro / Enterprise / ...)
 */
export type EfroPlan = "starter" | "pro" | "enterprise" | string;

/**
 * Nutzertext normalisieren
 */
function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Hilfsfunktionen fuer Intent-Detection
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
  // ansonsten auf quick_buy zurueckfallen.
  return currentIntent || "quick_buy";
}

/**
 * Versucht, aus dem Nutzertext einen Preisbereich zu lesen.
 * Beispiele:
 *  - "unter 50 euro"   -> maxPrice = 50
 *  - "bis 30 €"        -> maxPrice = 30
 *  - "über 100 euro"   -> minPrice = 100
 *  - "mindestens 200€" -> minPrice = 200
 */
function extractUserPriceRange(
  text: string
): { minPrice: number | null; maxPrice: number | null } {
  const t = normalize(text);

  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  // Erste Zahl mit "euro", "eur" oder "€" suchen
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
    maxPrice = value;
  } else if (hasOver && !hasUnder) {
    minPrice = value;
  } else {
    // Falls weder noch eindeutig ist: nur maxPrice setzen,
    // z.B. "Geschenk 50 Euro" -> wir interpretieren das als Budget-Obergrenze
    maxPrice = value;
  }

  return { minPrice, maxPrice };
}

/**
 * Produkt-Scoring fuer Keywords
 */
function scoreProductForWords(product: EfroProduct, words: string[]): number {
  if (words.length === 0) return 0;

  const title = normalize(product.title);
  const desc = normalize(product.description || "");
  const category = normalize(product.category || "");
  const tagsText = (product.tags || []).map((tag) => normalize(tag)).join(" ");
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
 * Max. Anzahl Empfehlungen je Plan
 * (Starter = weniger Karten, Enterprise = mehr Karten)
 */
function getMaxRecommendationsForPlan(plan?: EfroPlan): number {
  const p = (plan ?? "").toLowerCase();

  if (p === "starter") return 4;      // schlank, übersichtlich
  if (p === "pro") return 8;          // mehr Auswahl
  if (p === "enterprise") return 12;  // volle Power

  // Fallback / unbekannter Plan
  return 4;
}

/**
 * Produkte nach Keywords, Kategorie und Preis filtern
 * – NIE wieder [] zurückgeben, solange allProducts nicht leer ist.
 */
function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[],
  maxRecommendations: number
): EfroProduct[] {
  console.log("[EFRO Filter ENTER]", { text, intent, maxRecommendations });

  const t = normalize(text);

  if (allProducts.length === 0) {
    console.log("[EFRO Filter RESULT]", {
      text,
      intent,
      resultTitles: [],
    });
    return [];
  }

  // 0) Preisbereich erkennen
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
      let tmp = candidates.filter((p) => {
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
   * 5) Sortierung abhängig vom Intent
   */
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
    // Explore: wenn Budget gesetzt -> nach Preis, sonst alphabetisch
    if (hasBudget) {
      candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else {
      candidates.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  console.log("[EFRO Filter RESULT]", {
    text,
    intent,
    maxRecommendations,
    resultTitles: candidates.slice(0, maxRecommendations).map((p) => p.title),
  });

  // Anzahl der Vorschläge hängt jetzt vom Plan ab
  return candidates.slice(0, maxRecommendations);
}

/**
 * Reply-Text fuer EFRO bauen
 * - Nutzt Budget-Infos ("über 100 Euro", "bis 30 Euro", ...)
 * - Klingt wie ein Profi-Verkäufer, nicht wie ein Callcenter-Bot
 */
function buildReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[]
): string {
  const count = recommended.length;

  // 0 Treffer
  if (count === 0) {
    return (
      "Ich habe in den aktuellen Shop-Daten leider kein Produkt gefunden, das genau zu deiner Anfrage passt. " +
      "Wenn du mir deinen Wunsch ein bisschen anders beschreibst – zum Beispiel Kategorie oder Budget – probiere ich es gerne direkt noch einmal."
    );
  }

  // Hilfsfunktion zum Preisformat
  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "–";

  const first = recommended[0];

  // Budget aus dem User-Text erkennen
  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== null || maxPrice !== null;

  // Budget-Text für die Antwort bauen
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

  // Wenn ein Budget genannt wurde → Fokus: Budget-orientierter Pitch
  if (hasBudget) {
    if (count === 1) {
      return (
        `Ich habe ein Produkt gefunden, das gut zu deinem Budget ${budgetText} passt:\n\n` +
        `• ${first.title} – ${formatPrice(first)}\n\n` +
        "Wenn du möchtest, kann ich dir noch eine Alternative im ähnlichen Preisbereich zeigen oder wir passen das Budget noch einmal an."
      );
    }

    // Mehrere Treffer bei Budget-Anfrage
    const intro =
      `Ich habe mehrere Produkte passend zu deinem Budget ${budgetText} gefunden.\n` +
      `Ein sehr gutes Match ist:\n\n` +
      `• ${first.title} – ${formatPrice(first)}\n\n` +
      "Zusätzlich habe ich dir unten noch weitere passende Produkte eingeblendet:";

    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );

    const closing =
      "\n\nMöchtest du, dass ich dir noch ein oder zwei Alternativen im ähnlichen Preisbereich zeige – oder passt eines dieser Produkte für dich?";

    return [intro, "", ...lines, closing].join("\n");
  }

  // Kein explizites Budget → Intent-spezifischer Verkaufsstil
  if (intent === "premium") {
    if (count === 1) {
      return (
        `Ich habe ein hochwertiges Premium-Produkt für dich gefunden:\n\n` +
        `• ${first.title} – ${formatPrice(first)}\n\n` +
        "Das ist eine sehr gute Wahl, wenn dir Qualität wichtiger ist als der letzte Euro im Preis. " +
        "Wenn du möchtest, kann ich dir noch eine etwas günstigere Alternative mit gutem Preis-Leistungs-Verhältnis zeigen."
      );
    }

    const intro =
      "Ich habe dir eine Auswahl an hochwertigen Premium-Produkten zusammengestellt. " +
      "Ein besonders starkes Match ist:";

    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );

    const closing =
      "\n\nSchau dir die Vorschläge in Ruhe an. Wenn du lieber nach einer bestimmten Marke oder Kategorie filtern möchtest, sag mir einfach kurz Bescheid.";

    return [
      intro,
      "",
      `• ${first.title} – ${formatPrice(first)}`,
      "",
      ...lines,
      closing,
    ].join("\n");
  }

  if (intent === "bargain") {
    const intro =
      "Ich habe dir besonders preiswerte Produkte mit gutem Preis-Leistungs-Verhältnis herausgesucht.";
    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );
    const closing =
      "\n\nWenn du mir dein maximales Budget nennst, kann ich dir die wirklich günstigsten Optionen zeigen – ohne auf die Qualität zu verzichten.";

    return [intro, "", ...lines, closing].join("\n");
  }

  if (intent === "gift") {
    const intro =
      "Ich habe dir ein paar passende Geschenkideen zusammengestellt, die gut ankommen dürften:";
    const lines = recommended.map(
      (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
    );
    const closing =
      "\n\nSag mir gerne, für wen das Geschenk ist (z. B. Freundin, Kollege, Eltern) – dann kann ich noch gezielter empfehlen.";

    return [intro, "", ...lines, closing].join("\n");
  }

  // Standard-Fall (explore / quick_buy / bundle / sonstiges)
  if (count === 1) {
    return (
      `Ich habe ein passendes Produkt für dich gefunden:\n\n` +
      `• ${first.title} – ${formatPrice(first)}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  const intro =
    "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:";
  const lines = recommended.map(
    (p, idx) => `${idx + 1}. ${p.title} – ${formatPrice(p)}`
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
  plan?: EfroPlan
): SellerBrainResult {
  const raw = userText ?? "";
  const cleaned = raw.trim();

  // 🧹 Schutz: Wenn der "Text" nur aus Punkten/Leerzeichen/etc. besteht
  // (z. B. "...", "", "??") → NICHTS tun, keine neuen Empfehlungen.
  const hasLettersOrDigits = /[a-z0-9äöüß]/i.test(cleaned);
  if (!hasLettersOrDigits) {
    console.log("[EFRO SellerBrain] Noise input ignored", { userText: raw });
    return {
      // Intent beibehalten, keine neuen Empfehlungen
      intent: currentIntent || "quick_buy",
      recommended: [],
      replyText: "",
    };
  }

  const maxRecommendations = getMaxRecommendationsForPlan(plan);

  // Ab hier nur noch für echten Text mit Buchstaben/Zahlen
  const nextIntent = detectIntentFromText(cleaned, currentIntent);
  const recommended = filterProducts(
    cleaned,
    nextIntent,
    allProducts,
    maxRecommendations
  );
  const replyText = buildReplyText(cleaned, nextIntent, recommended);

  console.log("[EFRO SellerBrain]", {
    userText: cleaned,
    intent: nextIntent,
    plan,
    maxRecommendations,
    recCount: recommended.length,
  });

  return {
    intent: nextIntent,
    recommended,
    replyText,
  };
}
