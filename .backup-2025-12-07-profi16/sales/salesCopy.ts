// src/lib/sales/salesCopy.ts

import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";

export type SalesMessage = {
  headline: string;
  intro: string;
  productLines: string[];
  closing: string;
};

/**
 * Interne Helper: kurze Beschreibung, warum dieses Produkt vorgeschlagen wird.
 */
function getReasonForProduct(intent: ShoppingIntent, product: EfroProduct): string {
  switch (intent) {
    case "bargain":
      return "hat ein sehr gutes Preis-Leistungs-Verhaeltnis.";
    case "premium":
      return "ist eine hochwertige Premium-Loesung mit starker Qualitaet.";
    case "gift":
      return "eignet sich besonders gut als Geschenk.";
    case "quick_buy":
      return "ist eine einfache, schnelle Wahl – ohne viel Nachdenken.";
    case "explore":
      return "passt gut, wenn du erstmal verschiedene Optionen testen moechtest.";
    case "bundle":
      return "ist ein Bundle, mit dem du mehrere Dinge auf einmal abdeckst.";
    default:
      return "passt sehr gut zu deinen Angaben.";
  }
}

/**
 * Interne Helper: Headline je nach Intent
 */
function getHeadlineForIntent(intent: ShoppingIntent): string {
  switch (intent) {
    case "bargain":
      return "Top Empfehlungen mit starkem Preis-Leistungs-Verhaeltnis";
    case "premium":
      return "Premium Empfehlungen fuer maximale Qualitaet";
    case "gift":
      return "Geschenk-Empfehlungen, die gut ankommen";
    case "quick_buy":
      return "Schnelle Empfehlungen, damit du sofort entscheiden kannst";
    case "explore":
      return "Ein paar Ideen, die du entspannt anschauen kannst";
    case "bundle":
      return "Bundle-Empfehlungen, mit denen du mehr auf einmal bekommst";
    default:
      return "Meine Empfehlungen fuer dich";
  }
}

/**
 * Interne Helper: Intro-Satz je nach Intent
 */
function getIntroForIntent(intent: ShoppingIntent): string {
  switch (intent) {
    case "bargain":
      return "Du hast erwaehnt, dass dir ein guter Preis wichtig ist. Basierend darauf wuerde ich dir diese Optionen vorschlagen:";
    case "premium":
      return "Du legst Wert auf Qualitaet und bist bereit, etwas mehr zu investieren. Diese Produkte passen am besten dazu:";
    case "gift":
      return "Du suchst etwas als Geschenk. Hier sind ein paar Vorschlaege, mit denen du sehr wahrscheinlich ins Schwarze triffst:";
    case "quick_buy":
      return "Du moechtest dich schnell entscheiden. Hier sind meine 2-3 besten Vorschlaege, ohne dass du lange vergleichen musst:";
    case "explore":
      return "Du willst dich erstmal inspirieren lassen. Schau dir diese Auswahl entspannt an:";
    case "bundle":
      return "Du moechtest am liebsten gleich mehrere Dinge auf einmal loesen. Diese Bundles passen gut dazu:";
    default:
      return "Basierend auf deinen Angaben wuerde ich dir diese Produkte zuerst zeigen:";
  }
}

/**
 * Interne Helper: Closing / Call-to-Action
 */
function getClosingForIntent(intent: ShoppingIntent): string {
  switch (intent) {
    case "bargain":
      return "Wenn du magst, kann ich dir auch noch die absolut guenstigste Option heraussuchen – sag einfach kurz Bescheid.";
    case "premium":
      return "Wenn du noch mehr Details zur Qualitaet oder zu Alternativen brauchst, frag mich einfach – ich helfe dir beim Vergleich.";
    case "gift":
      return "Wenn du mir noch mehr ueber die Person erzaehlst, kann ich die Auswahl weiter verfeinern.";
    case "quick_buy":
      return "Wenn du dich fuer eines entschieden hast, lege ich es dir direkt in den Warenkorb.";
    case "explore":
      return "Wenn dir etwas gefaellt, kann ich dir dazu Varianten oder passende Zusatzprodukte zeigen.";
    case "bundle":
      return "Wenn du mir sagst, was dir im Bundle am wichtigsten ist, kann ich dir eine perfekte Kombination zusammenstellen.";
    default:
      return "Sag mir einfach, was dir am besten gefaellt – dann gehe ich den naechsten Schritt fuer dich.";
  }
}

/**
 * Baut eine komplette Verkaufsnachricht fuer den Avatar:
 * – headline: Ueberschrift fuer UI
 * – intro: 1–2 Saetze Einstieg
 * – productLines: einzelne Zeilen, je Produkt
 * – closing: Abschluss / CTA
 */
export function buildSalesMessage(
  intent: ShoppingIntent,
  products: EfroProduct[]
): SalesMessage {
  const headline = getHeadlineForIntent(intent);
  const intro = getIntroForIntent(intent);
  const closing = getClosingForIntent(intent);

  const productLines = products.map((p) => {
    const reason = getReasonForProduct(intent, p);
    const price = `${p.price.toFixed(2)} €`;
    return `${p.title} (${price}) – ${reason}`;
  });

  return {
    headline,
    intro,
    productLines,
    closing,
  };
}
