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
 * Tokenizer für Matching (dynamische Kategorien & Keywords)
 */
function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9äöüß]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

/**
 * Tags robust in Text umwandeln (Array oder String oder Sonstiges)
 */
function extractTagsText(product: EfroProduct): string {
  const raw: any = (product as any).tags;

  if (!raw) return "";

  // Array von Tags
  if (Array.isArray(raw)) {
    return raw
      .map((t) => normalize(String(t)))
      .filter(Boolean)
      .join(" ");
  }

  // Einzelner String: "Haushalt, Küche; Deko"
  if (typeof raw === "string") {
    return raw
      .split(/[;,]/)
      .map((t) => normalize(t.trim()))
      .filter(Boolean)
      .join(" ");
  }

  // Fallback: irgendein Wert → einfach als String nehmen
  return normalize(String(raw));
}

/**
 * Kategorie-Erkennung:
 * - arbeitet NUR mit den Kategorien, die im aktuellen Shop vorkommen
 * - fuzzy Matching: "Haustiere" matcht "Haustierbedarf & Zubehör"
 */
function detectCategoriesFromText(
  text: string,
  allProducts: EfroProduct[]
): { matchedCategories: string[]; hints: string[] } {
  const userWords = tokenize(text);
  if (userWords.length === 0) {
    return { matchedCategories: [], hints: [] };
  }

  // Alle Kategorien im Shop einsammeln (normalisiert)
  const categoryMap = new Map<string, string[]>(); // categoryText -> tokens
  for (const p of allProducts) {
    const catNorm = normalize(p.category || "");
    if (!catNorm || catNorm.length < 3) continue;
    if (!categoryMap.has(catNorm)) {
      categoryMap.set(catNorm, tokenize(catNorm));
    }
  }

  type CatScore = { category: string; score: number; hints: string[] };
  const scores: CatScore[] = [];

  for (const [cat, catWords] of categoryMap.entries()) {
    let score = 0;
    const localHints: string[] = [];

    for (const uw of userWords) {
      for (const cw of catWords) {
        if (!cw || !uw) continue;

        // exakter Token-Treffer
        if (uw === cw) {
          score += 3;
          localHints.push(uw);
        } else {
          const u4 = uw.slice(0, 4);
          const c4 = cw.slice(0, 4);

          // "haustier" vs "haustiere" / "wellness" vs "wellnessprodukte"
          if (u4.length >= 3 && (cw.startsWith(u4) || uw.startsWith(c4))) {
            score += 2;
            localHints.push(uw);
          } else if (uw.length >= 4 && cw.includes(uw)) {
            score += 1;
            localHints.push(uw);
          }
        }
      }
    }

    if (score > 0) {
      scores.push({ category: cat, score, hints: Array.from(new Set(localHints)) });
    }
  }

  if (scores.length === 0) {
    return { matchedCategories: [], hints: [] };
  }

  // Beste Kategorien auswählen (alles, was in der Nähe des Top-Scores liegt)
  scores.sort((a, b) => b.score - a.score);
  const bestScore = scores[0].score;
  // Mindestens 2 Punkte, sonst ignorieren wir das Matching
  if (bestScore < 2) {
    return { matchedCategories: [], hints: [] };
  }
  const threshold = Math.max(2, Math.floor(bestScore * 0.7));

  const selected = scores.filter((s) => s.score >= threshold);
  const matchedCategories = selected.map((s) => s.category);
  const hints = Array.from(new Set(selected.flatMap((s) => s.hints)));

  return { matchedCategories, hints };
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
    "qualität",
    "qualitaet",
    "qualitat",
    "luxus",
    "teuer",
  ];
  const bargainWords = [
    "billig",
    "günstig",
    "guenstig",
    "discount",
    "spar",
    "rabatt",
    "deal",
    "bargain",
    "günstigste",
    "günstigsten",
  ];
  const giftWords = ["geschenk", "gift", "präsent", "praesent", "praes", "present"];
  const bundleWords = ["bundle", "set", "paket", "combo"];
  const exploreWords = [
    "zeig mir was",
    "zeige mir",
    "zeigst du mir",
    "inspiration",
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
 */
function extractUserPriceRange(
  text: string
): { minPrice: number | null; maxPrice: number | null } {
  const t = normalize(text);

  let minPrice: number | null = null;
  let maxPrice: number | null = null;

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
 * Produkt-Scoring für Keywords
 */
function scoreProductForWords(product: EfroProduct, words: string[]): number {
  if (words.length === 0) return 0;

  const title = normalize(product.title);
  const desc = normalize(product.description || "");
  const category = normalize(product.category || "");
  const tagsText = extractTagsText(product);
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
 */
function getMaxRecommendationsForPlan(plan?: EfroPlan): number {
  const p = (plan ?? "").toLowerCase();

  if (p === "starter") return 4;
  if (p === "pro") return 8;
  if (p === "enterprise") return 12;

  return 4;
}

/**
 * Produkte nach Keywords, Kategorie und Preis filtern
 * – Ziel: nie [] zurückgeben, solange allProducts nicht leer ist.
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
   * 1) Kategorie-Erkennung (explizite Kategorie + dynamisch aus Katalog)
   */

  // 1a) Expliziter Kategoriename aus Formulierungen wie:
  //     "Kategorie Haustiere", "Kategorie Haushalt", "category pets"
  let explicitCategoryWord: string | null = null;

  const catMatchDe = t.match(/kategorie\s+([a-z0-9äöüß]+)/);
  const catMatchEn = t.match(/category\s+([a-z0-9äöüß]+)/);

  if (catMatchDe?.[1]) {
    explicitCategoryWord = catMatchDe[1];
  } else if (catMatchEn?.[1]) {
    explicitCategoryWord = catMatchEn[1];
  }

  // 1b) Dynamische Kategorie-Erkennung:
  //     - einmal mit dem ganzen Satz
  //     - einmal nur mit dem expliziten Kategorie-Wort (falls vorhanden)
  const catFromFull = detectCategoriesFromText(t, allProducts);
  const catFromExplicit = explicitCategoryWord
    ? detectCategoriesFromText(explicitCategoryWord, allProducts)
    : { matchedCategories: [] as string[], hints: [] as string[] };

  const matchedCategories = Array.from(
    new Set([...catFromFull.matchedCategories, ...catFromExplicit.matchedCategories])
  );
  const categoryHintsInText = Array.from(
    new Set([
      ...(explicitCategoryWord ? [explicitCategoryWord] : []),
      ...catFromFull.hints,
      ...catFromExplicit.hints,
    ])
  );

  if (matchedCategories.length > 0) {
    const before = candidates.length;
    candidates = candidates.filter((p) =>
      matchedCategories.includes(normalize(p.category || ""))
    );
    console.log("[EFRO Filter CATEGORY_APPLIED]", {
      text,
      explicitCategoryWord,
      matchedCategories,
      from: before,
      to: candidates.length,
      exampleTitles: candidates.slice(0, 6).map((p) => p.title),
    });
  }

  console.log("[EFRO Filter CATEGORY]", {
    text,
    explicitCategoryWord,
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
    "qualität",
    "qualitaet",
    "qualitat",
    "luxus",
    "teuer",
    "teure",
    "teuren",
    "teuerste",
    "teuersten",
    "billig",
    "günstig",
    "guenstig",
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
    "präsent",
    "praesent",
    "praes",
    "present",
    "bundle",
    "set",
    "paket",
    "combo",

    // generische Produktwörter
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
    "über",
    "ueber",
    "bis",
    "maximal",
    "mindestens",
    "höchstens",
    "hoechstens",
    "weniger",
    "mehr",
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
    "dankeschön",
    "dankeschoen",
    "meine",
    "deine",
    "und",
    "oder",
    "die",
    "der",
    "das",
    "den",
    "kategorie",
    "category",
  ];

  let words: string[] = tokenize(t).filter((w) => !intentWords.includes(w));

  // reine Zahlen wie "100" NICHT als Keywords benutzen
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
    }
  }

  /**
   * 3) Intent-/Preis-Logik
   */
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  if (userMinPrice !== null || userMaxPrice !== null) {
    minPrice = userMinPrice;
    maxPrice = userMaxPrice;
  } else {
    if (intent === "premium") {
      minPrice = 600;
    } else if (intent === "bargain") {
      maxPrice = 400;
    } else if (intent === "gift") {
      minPrice = 300;
      maxPrice = 700;
    }
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
   * 5) Sortierung abhängig vom Intent
   */
  if (intent === "premium") {
    candidates.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  } else if (
    intent === "bargain" ||
    intent === "gift" ||
    intent === "quick_buy"
  ) {
    candidates.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  } else if (intent === "explore") {
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

  return candidates.slice(0, maxRecommendations);
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
      "Wenn du mir deinen Wunsch ein bisschen anders beschreibst – zum Beispiel Kategorie oder Budget – probiere ich es gerne direkt noch einmal."
    );
  }

  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "–";

  const first = recommended[0];

  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== null || maxPrice !== null;

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

  if (hasBudget) {
    if (count === 1) {
      return (
        `Ich habe ein Produkt gefunden, das gut zu deinem Budget ${budgetText} passt:\n\n` +
        `• ${first.title} – ${formatPrice(first)}\n\n` +
        "Wenn du möchtest, kann ich dir noch eine Alternative im ähnlichen Preisbereich zeigen oder wir passen das Budget noch einmal an."
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
      "\n\nMöchtest du, dass ich dir noch ein oder zwei Alternativen im ähnlichen Preisbereich zeige – oder passt eines dieser Produkte für dich?";

    return [intro, "", ...lines, closing].join("\n");
  }

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

  // Schutz gegen reinen Noise („...“, „??“, nur Leerzeichen)
  const hasLettersOrDigits = /[a-z0-9äöüß]/i.test(cleaned);
  if (!hasLettersOrDigits) {
    console.log("[EFRO SellerBrain] Noise input ignored", { userText: raw });
    return {
      intent: currentIntent || "quick_buy",
      recommended: [],
      replyText: "",
    };
  }

  const maxRecommendations = getMaxRecommendationsForPlan(plan);

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
