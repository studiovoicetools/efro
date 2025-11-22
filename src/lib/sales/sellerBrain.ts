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
  const t = normalize(text);

  let candidates = [...allProducts];

  // 1) Keyword-Filter: Snowboard
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

  // 2) Intent-basierte Preisfilter
  if (intent === "premium") {
    // Premium: hoehere Preise bevorzugen
    candidates = candidates.filter((p) => p.price >= 600);
    candidates.sort((a, b) => b.price - a.price);
  } else if (intent === "bargain") {
    // Bargain: guenstigere Produkte bevorzugen
    candidates = candidates.filter((p) => p.price <= 400);
    candidates.sort((a, b) => a.price - b.price);
  } else if (intent === "gift") {
    // Geschenk: mittlerer Preisbereich
    candidates = candidates.filter((p) => p.price >= 300 && p.price <= 700);
    candidates.sort((a, b) => a.price - b.price);
  } else if (intent === "bundle") {
    // Bundle: Produkte mit Tags wie "bundle" oder "set"
    candidates = candidates.filter((p) => {
      const tags = (p.tags || []).map((tag) => normalize(tag));
      return tags.includes("bundle") || tags.includes("set");
    });
  } else if (intent === "explore") {
    // Explore: alles zulassen, aber ein bisschen durchmischen
    candidates.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    // quick_buy / default: nach Relevanz -> Preis mittlerer Bereich
    candidates.sort((a, b) => a.price - b.price);
  }

  // Fallback, falls nach Filtern nichts mehr uebrig ist
  if (candidates.length === 0) {
    candidates = [...allProducts];
    // Snowboard-Wunsch nochmal versuchen, aber ohne harte Preisfilter
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

  // Maximal 3–4 Vorschlaege zurueckgeben
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
  if (recommended.length === 0) {
    return (
      "Ich habe gerade keine passenden Produkte gefunden. " +
      "Pruefe bitte deinen Katalog oder frag mich noch einmal etwas genauer, z.B.: 'Zeig mir ein Snowboard unter 500 Euro'."
    );
  }

  const introByIntent: Record<ShoppingIntent, string> = {
    quick_buy:
      "Alles klar, ich habe dir ein paar Produkte rausgesucht, die du schnell kaufen kannst:",
    bargain:
      "Du suchst etwas guenstiges – hier sind passende Sparangebote aus deinem Katalog:",
    premium:
      "Du willst Premium-Qualitaet – das sind deine Top-Produkte mit hoher Qualitaet:",
    gift:
      "Du suchst ein Geschenk – diese Produkte eignen sich gut als Praesent:",
    bundle:
      "Du willst ein Bundle oder Set – diese Produkte lassen sich gut kombinieren:",
    explore:
      "Lass uns ein bisschen stoebern – hier sind ein paar Inspirationen aus deinem Shop:",
  };

  const intro = introByIntent[intent] ?? introByIntent.quick_buy;

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
