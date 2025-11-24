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
 * Nutzertext normalisieren
 */
function normalize(text: string): string {
  return text.toLowerCase();
}

/**
 * Hilfsfunktionen fuer Intent-Detection
 */
function detectIntentFromText(text: string, currentIntent: ShoppingIntent): ShoppingIntent {
  const t = normalize(text);

  const premiumWords = ["premium", "beste", "hochwertig", "qualitaet", "qualitat", "luxus", "teuer"];
  const bargainWords = ["billig", "guenstig", "günstig", "discount", "spar", "rabatt", "deal", "bargain"];
  const giftWords = ["geschenk", "gift", "praesent", "praes", "present"];
  const bundleWords = ["bundle", "set", "paket", "combo"];
  const exploreWords = ["zeig mir was", "inspiration", "zeige mir", "was hast du", "was gibt es"];

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
 * Produkte nach Keywords, Snowboard, Preis etc. filtern
 * – NIE wieder [] zurückgeben, solange allProducts nicht leer ist.
 */
function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[]
): EfroProduct[] {
  console.log("[EFRO Filter ENTER]", { text, intent });

  const t = normalize(text);

  // Start: immer mit allen Produkten arbeiten
  let candidates = [...allProducts];

  // --------------------------------------------------
  // 1) Sonderfall: Snowboard
  // --------------------------------------------------
  const snowboardWords = ["snowboard", "board", "snow"];
  const wantsSnowboard = snowboardWords.some((w) => t.includes(w));

  if (wantsSnowboard) {
    candidates = candidates.filter((p) => {
      const title = normalize(p.title);
      const desc = normalize(p.description || "");
      const tags = (p.tags || []).map((tag) => normalize(tag));

      return (
        title.includes("snowboard") ||
        desc.includes("snowboard") ||
        tags.includes("snowboard")
      );
    });
  }

  // --------------------------------------------------
  // 2) Keyword-Erkennung (Produktnamen etc.)
  //    → Bei echten Produktwörtern RETURNEN wir hier.
  //    → Wenn KEINE Matches: KEIN return [], sondern Intent-Fallback.
  // --------------------------------------------------
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

    "geschenk",
    "gift",
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

    // Füllwörter
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
  ];

  let words: string[] = [];

  if (!wantsSnowboard) {
    words = t
      .split(/[^a-z0-9äöüß]+/i)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 3 && !intentWords.includes(w));

    console.log("[EFRO Filter WORDS]", { text, words });

    if (words.length > 0) {
      // Konkrete Begriffe wie duschgel, napfset, federstab …
      const keywordMatches = candidates.filter((p) => {
        const title = normalize(p.title);
        const desc = normalize(p.description || "");
        const category = normalize(p.category || "");
        const tagsText = (p.tags || [])
          .map((tag) => normalize(tag))
          .join(" ");

        const matches = words.some(
          (word) =>
            title.includes(word) ||
            desc.includes(word) ||
            category.includes(word) ||
            tagsText.includes(word)
        );

        return matches;
      });

      if (keywordMatches.length > 0) {
        console.log("[EFRO Filter KEYWORD_MATCHES]", {
          text,
          words,
          matchedTitles: keywordMatches.map((p) => p.title),
        });

        const strongMatches = keywordMatches.filter((p) => {
          const title = normalize(p.title);
          const tagsText = (p.tags || [])
            .map((tag) => normalize(tag))
            .join(" ");
          return words.some(
            (word) => title.includes(word) || tagsText.includes(word)
          );
        });

        console.log("[EFRO Filter STRONG_MATCHES]", {
          text,
          words,
          strongTitles: strongMatches.map((p) => p.title),
        });

        const base = strongMatches.length > 0 ? strongMatches : keywordMatches;
        const sorted = [...base];

        // Relevanz sortieren
        sorted.sort((a, b) => {
          const aTitle = normalize(a.title);
          const aDesc = normalize(a.description || "");
          const aCategory = normalize(a.category || "");
          const aTagsText = (a.tags || [])
            .map((tag) => normalize(tag))
            .join(" ");
          const aBlob = `${aTitle} ${aDesc} ${aCategory} ${aTagsText}`;

          const bTitle = normalize(b.title);
          const bDesc = normalize(b.description || "");
          const bCategory = normalize(b.category || "");
          const bTagsText = (b.tags || [])
            .map((tag) => normalize(tag))
            .join(" ");
          const bBlob = `${bTitle} ${bDesc} ${bCategory} ${bTagsText}`;

          let aScore = 0;
          let bScore = 0;

          words.forEach((word) => {
            if (aTitle.includes(word)) aScore += 3;
            else if (aBlob.includes(word)) aScore += 1;

            if (bTitle.includes(word)) bScore += 3;
            else if (bBlob.includes(word)) bScore += 1;
          });

          return bScore - aScore;
        });

        console.log("[EFRO Filter RESULT]", {
          text,
          intent,
          resultTitles: sorted.slice(0, 3).map((p) => p.title),
        });

        // Bei echten Keywords hier hart returnen:
        return sorted.slice(0, 3);
      } else {
        // Keine Keyword-Treffer → nicht abbrechen, später Intent-Fallback
        console.log("[EFRO Filter NO_KEYWORD_MATCH]", {
          text,
          intent,
          words,
        });
      }
    }
  }

  // --------------------------------------------------
  // 3) Intent-basierter Fallback (Preis / Bundle / Gift / Explore)
  //    Dieser Block wird IMMER ausgeführt, wenn oben nicht
  //    bereits über Keyword-Matching returned wurde.
  // --------------------------------------------------
  console.log("[EFRO Filter FALLBACK_INTENT]", {
    text,
    intent,
    candidateTitles: candidates.map((p) => p.title),
  });

  if (intent === "premium") {
    candidates = candidates.filter((p) => p.price >= 600);
    candidates.sort((a, b) => b.price - a.price);
  } else if (intent === "bargain") {
    candidates = candidates.filter((p) => p.price > 0 && p.price <= 400);
    candidates.sort((a, b) => a.price - b.price);
  } else if (intent === "gift") {
    candidates = candidates.filter((p) => p.price >= 300 && p.price <= 700);
    candidates.sort((a, b) => a.price - b.price);
  } else if (intent === "bundle") {
    candidates = candidates.filter((p) => {
      const tags = (p.tags || []).map((tag) => normalize(tag));
      return tags.includes("bundle") || tags.includes("set");
    });
  } else if (intent === "explore") {
    candidates.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // quick_buy / default
    candidates.sort((a, b) => a.price - b.price);
  }

  // Fallback: Wenn nach Filtern nichts mehr übrig ist, nicht leer zurückgeben
  if (candidates.length === 0) {
    candidates = [...allProducts];

    if (wantsSnowboard) {
      candidates = candidates.filter((p) => {
        const title = normalize(p.title);
        const desc = normalize(p.description || "");
        const tags = (p.tags || []).map((tag) => normalize(tag));

        return (
          title.includes("snowboard") ||
          desc.includes("snowboard") ||
          tags.includes("snowboard")
        );
      });

      if (candidates.length === 0) {
        candidates = [...allProducts];
      }
    }
  }

  console.log("[EFRO Filter RESULT]", {
    text,
    intent,
    resultTitles: candidates.slice(0, 4).map((p) => p.title),
  });

  // Maximal 3–4 Vorschläge
  return candidates.slice(0, 4);
}

/**
 * Reply-Text fuer EFRO bauen
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
      "Wenn du mir deinen Wunsch etwas anders beschreibst, probiere ich es gerne noch einmal."
    );
  }

  // 1 Treffer
  if (count === 1) {
    const product = recommended[0];
    const price = product.price ? product.price.toFixed(2) : "0.00";
    return (
      `Ich habe das passende Produkt für dich gefunden: ${product.title} für ${price} €. ` +
      "Unten siehst du alle Details."
    );
  }

  // Mehrere Treffer
  const intro = `Ich habe ${count} passende Produkte für dich gefunden:`;
  const lines = recommended.map(
    (p, idx) => `${idx + 1}. ${p.title} – ${p.price.toFixed(2)} €`
  );

  return [intro, "", ...lines].join("\n");
}

/**
 * Hauptfunktion, die vom Chat/Avatar aufgerufen wird
 */
export function runSellerBrain(
  userText: string,
  currentIntent: ShoppingIntent,
  allProducts: EfroProduct[]
): SellerBrainResult {
  const nextIntent = detectIntentFromText(userText, currentIntent);
  const recommended = filterProducts(userText, nextIntent, allProducts);
  const replyText = buildReplyText(userText, nextIntent, recommended);

  return {
    intent: nextIntent,
    recommended,
    replyText,
  };
}
