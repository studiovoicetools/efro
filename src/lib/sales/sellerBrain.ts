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
 * Produkte nach Snowboard, Preis etc. filtern
 */
function filterProducts(
  text: string,
  intent: ShoppingIntent,
  allProducts: EfroProduct[]
): EfroProduct[] {
  console.log("[EFRO Filter ENTER]", { text, intent });

  const t = normalize(text);

  let candidates = [...allProducts];

  // 1) Sonderfall: Snowboard
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

  // 2) Generische Keyword-Suche (nur wenn nicht Snowboard)
  let words: string[] = [];
  let anyKeywordMatch = false;

  if (!wantsSnowboard) {
    const intentWords = [
      "premium",
      "beste",
      "hochwertig",
      "qualitaet",
      "qualitat",
      "luxus",
      "teuer",
      "billig",
      "guenstig",
      "günstig",
      "discount",
      "spar",
      "rabatt",
      "deal",
      "bargain",
      "geschenk",
      "gift",
      "praesent",
      "praes",
      "present",
      // "set" ist bewusst NICHT hier, damit Napfset, Starter-Set usw.
      // als Produkt-Keywords erkannt werden koennen
      "bundle",
      "paket",
      "combo",
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
    ];

    words = t
      .split(/[^a-z0-9äöüß]+/i)
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 3 && !intentWords.includes(w));

    console.log("[EFRO Filter WORDS]", { text, words });

    // Wenn konkrete Suchwoerter vorhanden sind, danach filtern
    if (words.length > 0) {
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

        // Flag setzen, sobald ein Produkt in keywordMatches landet
        if (matches) {
          anyKeywordMatch = true;
        }

        return matches;
      });

      // Direkt nach der Schleife: Wenn words vorhanden, aber keine Matches
      if (words.length > 0 && !anyKeywordMatch) {
        console.log("[EFRO Filter NO_KEYWORD_MATCH]", {
          text,
          intent,
          words,
        });
        return [];
      }

      // Wenn Keyword-Matches gefunden wurden, diese verwenden
      if (keywordMatches.length > 0) {
        console.log("[EFRO Filter KEYWORD_MATCHES]", {
          text,
          words,
          matchedTitles: keywordMatches.map((p) => p.title),
        });

        // Schritt 1: starke Matches = Keyword steht im TITEL oder in TAGS
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

        // Schritt 2: Wenn starke Matches (Titel/Tags) existieren, NUR diese verwenden
        if (strongMatches.length > 0) {
          // Nur starke Matches verwenden, nach Relevanz sortieren
          const sorted = [...strongMatches];

          sorted.sort((a, b) => {
            const aTitle = normalize(a.title);
            const aTagsText = (a.tags || [])
              .map((tag) => normalize(tag))
              .join(" ");
            const aBlob = `${aTitle} ${aTagsText}`;

            const bTitle = normalize(b.title);
            const bTagsText = (b.tags || [])
              .map((tag) => normalize(tag))
              .join(" ");
            const bBlob = `${bTitle} ${bTagsText}`;

            let aScore = 0;
            let bScore = 0;

            words.forEach((word) => {
              if (aTitle.includes(word)) aScore += 3;
              else if (aTagsText.includes(word)) aScore += 2;
              else if (aBlob.includes(word)) aScore += 1;

              if (bTitle.includes(word)) bScore += 3;
              else if (bTagsText.includes(word)) bScore += 2;
              else if (bBlob.includes(word)) bScore += 1;
            });

            return bScore - aScore;
          });

          console.log("[EFRO Filter RESULT]", {
            text,
            intent,
            resultTitles: sorted.slice(0, 3).map((p) => p.title),
          });

          return sorted.slice(0, 3);
        }

        // Schritt 3: Falls keine starken Matches, nach Relevanz sortieren (Titel-Match > Rest)
        const baseMatches = keywordMatches;
        const sorted = [...baseMatches];

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

        // Wichtig:
        // - Wenn keine starken Matches (Titel/Tags), verwenden wir alle Keyword-Matches
        // - Maximal 3 Stueck (z.B. 3 verschiedene Duschgele)
        console.log("[EFRO Filter RESULT]", {
          text,
          intent,
          resultTitles: sorted.slice(0, 3).map((p) => p.title),
        });

        return sorted.slice(0, 3);
      }
    }
  }

  // 3) Intent-basierte Preisfilter (nur wenn keine Keyword-Matches gegriffen haben)
  // WICHTIG: Nur ausfuehren, wenn words.length === 0 (keine Keywords vorhanden)
  if (words.length === 0) {
    console.log("[EFRO Filter FALLBACK_INTENT]", {
      text,
      intent,
      candidateTitles: candidates.map((p) => p.title),
    });

    if (intent === "premium") {
      candidates = candidates.filter((p) => p.price >= 600);
      candidates.sort((a, b) => b.price - a.price);
    } else if (intent === "bargain") {
      candidates = candidates.filter((p) => p.price <= 400);
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
      candidates.sort((a, b) => a.price - b.price);
    }

    // Fallback, falls nach Filtern nichts mehr uebrig ist
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

    // Maximal 3–4 Vorschlaege zurueckgeben
    return candidates.slice(0, 4);
  }

  // Falls words.length > 0, aber keine Matches gefunden wurden (sollte bereits oben abgefangen sein)
  // Dieser Fall sollte eigentlich nicht erreicht werden, aber als Sicherheit:
  console.log("[EFRO Filter RESULT]", {
    text,
    intent,
    resultTitles: [],
  });

  return [];
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

  if (count === 0) {
    return (
      "Entschuldigung, ich habe aktuell keine passenden Produkte im Katalog gefunden. " +
      "Bitte versuche es mit einer anderen Suchanfrage oder kontaktiere den Support."
    );
  }

  // Anpassung basierend auf Anzahl der Treffer
  let intro: string;
  if (count === 1) {
    intro = "Ich habe das passende Produkt für dich gefunden:";
  } else {
    intro = `Ich habe ${count} passende Produkte für dich gefunden:`;
  }

  const lines = recommended.map(
    (p, idx) =>
      `${idx + 1}. ${p.title} – ${p.price.toFixed(2)} €` +
      (p.tags && p.tags.length > 0 ? ` (Tags: ${p.tags.join(", ")})` : "")
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
