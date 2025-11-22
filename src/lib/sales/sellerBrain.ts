// src/lib/sales/sellerBrain.ts

import {
  EfroProduct,
  ShoppingIntent,
} from "@/lib/products/mockCatalog";
import {
  getRecommendationsForIntent,
  getRecommendationsForIntentFromList,
} from "../products/recommendationEngine";

import { buildSalesMessage } from "./salesCopy";
import { getRelatedProducts } from "../products/relatedProducts";

export type SellerBrainResult = {
  intent: ShoppingIntent;
  replyText: string;
  recommended: EfroProduct[];
};

/**
 * Harte Normalisierung fuer Intent-Erkennung:
 * - Kleinbuchstaben
 * - Tuerkische Buchstaben auf ASCII mappen
 * - Umlaute und Akzente vereinfachen
 */
function normalizeForIntent(text: string): string {
  let t = text.toLowerCase();

  // Tuerkische Buchstaben & Umlaute explizit mappen
  const replacements: Array<[RegExp, string]> = [
    // Tuerkisch / Deutsch
    [/[Ã¶Å‘Ã²Ã³Ã´Ãµ]/g, "o"],
    [/[Ã¼ÃºÃ¹Ã»]/g, "u"],
    [/[Ã¤Ã¢Ã¡Ã ]/g, "a"],
    [/[Ã©Ã¨ÃªÃ«]/g, "e"],
    [/[Ä±]/g, "i"],      // tuerkisches Ä± -> i
    [/[ÅŸÅ¡]/g, "s"],     // s-Varianten
    [/[ÄŸ]/g, "g"],
    [/[Ã§]/g, "c"],
    [/[ÃŸ]/g, "ss"],

    // Sicherheitshalber auch Grossbuchstaben (falls toLowerCase mal zickt)
    [/[Ã–ÅÃ’Ã“Ã”Ã•]/g, "o"],
    [/[ÃœÃšÃ™Ã›]/g, "u"],
    [/[Ã„Ã‚ÃÃ€]/g, "a"],
    [/[Ã‰ÃˆÃŠÃ‹]/g, "e"],
    [/[Ä°I]/g, "i"],
    [/[ÅÅ ]/g, "s"],
    [/[Ä]/g, "g"],
    [/[Ã‡]/g, "c"],
  ];

  for (const [pattern, repl] of replacements) {
    t = t.replace(pattern, repl);
  }

  // Generische Unicode-Diacritics entfernen (z. B. ungewÃ¶hnliche Akzente)
  try {
    t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  } catch {
    // falls normalize in der Runtime nicht verfuegbar ist, einfach ignorieren
  }

  // Mehrfach-Leerzeichen auf eins reduzieren
  t = t.replace(/\s+/g, " ").trim();

  return t;
}

/**
 * Intent-Erkennung aus freiem Text.
 * Wird an allen Stellen zentral verwendet (Dev-Chat, Avatar-Seller, spaeter Voice).
 */
export function detectIntentFromText(
  text: string,
  fallback: ShoppingIntent
): ShoppingIntent {
  const t = normalizeForIntent(text);

  // DEBUG optional:
  // console.log("[SellerBrain] RAW:", text, "NORMALIZED:", t);

  // 1) Spezifische Intents zuerst (premium, gift, bundle),
  //    dann bargain/explore, am Ende fallback.

  // PREMIUM / LUXUS / TEUER
  if (
    t.includes("premium") ||
    t.includes("luxus") ||
    t.includes("luxusprodukt") ||
    t.includes("luxurio") || // luxuriÃ¶s, luxurius etc.
    t.includes("high end") ||
    t.includes("high-end") ||
    t.includes("teuerste") ||
    t.includes("teures") ||
    t.includes("beste qualitaet") ||
    t.includes("en iyi") ||     // TR: "am besten"
    t.includes("en pahali")     // TR: "am teuersten"
  ) {
    return "premium";
  }

  // GIFT / GESCHENK / HEDIYE
  if (
    t.includes("gift") ||
    t.includes("geschenk") ||
    t.includes("present") ||
    t.includes("gutschein") ||
    t.includes("hediye")      // TR: Geschenk
  ) {
    return "gift";
  }

  // BUNDLE / SET / PAKET
  if (
    t.includes("bundle") ||
    t.includes(" set") ||
    t.startsWith("set ") ||
    t.includes("paket") ||
    t.includes("pack") ||
    t.includes("paketi")      // TR: Paket
  ) {
    return "bundle";
  }

  // BARGAIN / GUENSTIG / UCUZ / FIYAT
  if (
    t.includes("cheap") ||
    t.includes("guenstig") ||
    t.includes("gunstig") ||
    t.includes("preiswert") ||
    t.includes("billig") ||
    t.includes("preis ") ||
    t.includes("preis-") ||
    t.includes("price") ||
    t.includes("ucuz") ||       // TR: billig
    t.includes("fiyat") ||      // TR: Preis
    t.includes("indirim")       // TR: Rabatt
  ) {
    return "bargain";
  }

  // EXPLORE / IDEEN / INSPIRATION
  if (
    t.includes("idee") ||
    t.includes("ideen") ||
    t.includes("inspir") ||
    t.includes("vorschlag") ||
    t.includes("vorschlaege") ||
    t.includes("ilham") ||      // TR: Inspiration
    t.includes("fikir")         // TR: Idee
  ) {
    return "explore";
  }

  // 2) Wenn nichts passt: alten Intent behalten
  return fallback;
}

/**
 * Zentrale Verkaufslogik:
 * - nimmt User-Text + vorherigen Intent + Produktliste
 * - erkennt neuen Intent
 * - waehlt passende Produkte (Empfehlung + Cross-Sell)
 * - baut eine fertige EFRO-Antwort als Text
 * - gibt Intent + Text + empfohlene Produkte zurueck
 *
 * --> Kann von Dev-Chat, Avatar-Seller, Voice-Routen wiederverwendet werden.
 */
export function runSellerBrain(
  userText: string,
  prevIntent: ShoppingIntent,
  allProducts: EfroProduct[]
): SellerBrainResult {
  const intent = detectIntentFromText(userText, prevIntent);

  // 1) Empfehlungen fuer diesen Intent
  const recommended = getRecommendationsForIntentFromList(
    intent,
    allProducts,
    3
  );

  // 2) Sales-Text auf Basis der empfohlenen Produkte
  const msg = buildSalesMessage(intent, recommended);

  const parts: string[] = [];
  parts.push(msg.intro);
  parts.push("");

  for (const line of msg.productLines) {
    parts.push("â€¢ " + line);
  }

  // 3) Cross-Sell basierend auf Hauptprodukt
  if (recommended.length > 0) {
    const main = recommended[0];
    const related = getRelatedProducts(main, allProducts, 2);
    if (related.length > 0) {
      parts.push("");
      parts.push(
        `Wenn du besonders zu "${main.title}" tendierst, passen diese Produkte sehr gut dazu:`
      );
      for (const r of related) {
        parts.push(`â†’ ${r.title} (${r.price.toFixed(2)} â‚¬)`);
      }
    }
  }

  parts.push("");
  parts.push(msg.closing);

  const replyText = parts.join("\n");

  return {
    intent,
    replyText,
    recommended,
  };
}
