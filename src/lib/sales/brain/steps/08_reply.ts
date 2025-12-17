// src/lib/sales/brain/steps/08_reply.ts

import { detectMostExpensiveRequest } from "../../intent";
import { extractUserPriceRange } from "../../budget";
import type { SellerBrainAiTrigger } from "../../modules/aiTrigger";

import { kbRoute } from "../../kb/kbRouter";
import type { StoreFacts } from "../../kb/storeFacts";
import {
  QUERY_STOPWORDS,
  ATTRIBUTE_PHRASES,
  ATTRIBUTE_KEYWORDS,
} from "../../languageRules.de";

import type { ShoppingIntent } from "@/lib/products/mockCatalog";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type ProductAttributeMap = Record<string, string[]>;

type ParsedQuery = {
  coreTerms: string[];
  attributeTerms: string[];
  attributeFilters: ProductAttributeMap;
};

type ExplanationMode = "ingredients" | "materials" | "usage" | "care" | "washing";

type ProfisellerScenarioId =
  | "S1"
  | "S2"
  | "S3"
  | "S4"
  | "S5"
  | "S6"
  | "fallback";



function normalizeText(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9Ã¤Ã¶Ã¼ÃŸ\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(input: string | null | undefined): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeProductCode(term: string): boolean {
  // z.B. "ABC123", "SKU-99", "X9Z"
  const t = String(term ?? "").trim();
  if (!t) return false;
  return /^[A-Z0-9][A-Z0-9_-]{2,}$/.test(t.toUpperCase());
}

function detectExplanationMode(text: string): ExplanationMode | null {
  const t = normalizeText(text);

  // Inhaltsstoffe
  if (/\b(inhaltsstoff|inhaltsstoffe|ingredients?)\b/i.test(t)) return "ingredients";

  // Material
  if (/\b(material|materials|stoff|gewebe|leder|wolle|baumwolle|polyester)\b/i.test(t))
    return "materials";

  // Anwendung
  if (/\b(anwendung|verwenden|benutzen|gebrauch|use|usage|how to)\b/i.test(t)) return "usage";

  // Pflege/Waschen
  if (/\b(pflege|care|wasch|washing|waschen|wÃ¤sche|trockner|bÃ¼geln)\b/i.test(t))
    return "washing";

  return null;
}

function parseQueryForAttributes(text: string): ParsedQuery {
  const normalized = normalizeText(text);
  const stopwords = QUERY_STOPWORDS;

  const foundPhrases: string[] = [];
  let remainingText = normalized;

  for (const phrase of ATTRIBUTE_PHRASES) {
    if (remainingText.includes(phrase)) {
      foundPhrases.push(phrase);
      remainingText = remainingText.replace(phrase, " ");
    }
  }

  const remainingTokens = remainingText
    .split(" ")
    .filter((t) => t.length >= 3 && !stopwords.includes(t));

  const attributeTerms: string[] = [...foundPhrases];
  const coreTerms: string[] = [];

  for (const token of remainingTokens) {
    const isAttr =
      ATTRIBUTE_KEYWORDS.includes(token) || foundPhrases.some((p) => p.includes(token));

    if (isAttr) {
      if (!attributeTerms.includes(token)) attributeTerms.push(token);
    } else {
      coreTerms.push(token);
    }
  }

  const attributeFilters: ProductAttributeMap = {};
  return { coreTerms, attributeTerms, attributeFilters };
}

function getDescriptionSnippet(input: unknown, maxLen = 140): string {
  // akzeptiert:
  // - string
  // - Objekt mit description/descriptionHtml
  let raw = "";

  if (typeof input === "string") raw = input;
  else if (input && typeof input === "object") {
    const obj = input as { description?: unknown; descriptionHtml?: unknown };
    if (typeof obj.description === "string") raw = obj.description;
    else if (typeof obj.descriptionHtml === "string") raw = obj.descriptionHtml;
  }

  if (!raw) return "";

  let text = raw.replace(/<[^>]*>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= maxLen) return text;

  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace >= 40 ? cut.slice(0, lastSpace) : cut;

  return safe.trim() + "â€¦";
}

function detectProfisellerScenarioId(args: {
  count: number;
  hasBudget: boolean;
  hasCategory: boolean;
}): ProfisellerScenarioId {
  const { count, hasBudget, hasCategory } = args;

  if (count <= 0) return "S6";
  if (hasBudget && !hasCategory) return "S4";
  if (hasCategory && !hasBudget) return "S5";
  if (count === 1) return "S1";
  if (count === 2) return "S2";
  if (count >= 3) return "S3";
  return "fallback";
}

export function buildRuleBasedReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[],
  _plan?: string
): string {
  const count = recommended.length;

  const formatPrice = (p: EfroProduct) => {
    const n = typeof p.price === "number" ? p.price : Number(p.price);
    return Number.isFinite(n) ? `${n.toFixed(2)} â‚¬` : "â‚¬";
  };

  // ZERO RESULTS
  if (count === 0) {
    return (
      `Zu deiner aktuellen Anfrage habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
      `Das liegt oft daran, dass entweder die Kategorie noch zu allgemein ist oder dein Wunsch sehr speziell ist. ` +
      `Wenn du mÃ¶chtest, versuche es bitte mit einer etwas genaueren Beschreibung ` +
      `(zum Beispiel: Produktart + Einsatzzweck + grober Preisrahmen), ` +
      `oder nenn mir eine andere Kategorie oder ein Budget, dann suche ich erneut fÃ¼r dich. ` +
      `Du kannst mir auch einfach sagen, ob du eher etwas GÃ¼nstiges, etwas Hochwertiges ` +
      `oder eine bestimmte Marke suchst â€“ dann kann ich dir gezielter helfen.`
    );
  }

  const first = recommended[0];

  // Budget
  const priceRange = extractUserPriceRange(text) as {
    minPrice?: number | null;
    maxPrice?: number | null;
  };
  const minPrice = priceRange.minPrice ?? null;
  const maxPrice = priceRange.maxPrice ?? null;
  const hasBudget = minPrice !== null || maxPrice !== null;

  let budgetText = "";
  if (hasBudget) {
    if (minPrice !== null && maxPrice === null) budgetText = `ab etwa ${minPrice} â‚¬`;
    else if (maxPrice !== null && minPrice === null) budgetText = `bis etwa ${maxPrice} â‚¬`;
    else if (minPrice !== null && maxPrice !== null)
      budgetText = `zwischen ${minPrice} â‚¬ und ${maxPrice} â‚¬`;
  }

  // Attribute parsing (fÃ¼r Premium/Bargain Texte)
  const parsed = parseQueryForAttributes(text);
  const { attributeTerms } = parsed;

  // Explanation mode hat PrioritÃ¤t
  const explanationMode = detectExplanationMode(text);
  if (explanationMode) {
    const desc = (first?.description ? String(first.description) : "").trim();
    const snippet = desc ? getDescriptionSnippet(desc) : "";
    const hasDesc = !!snippet;

    const categoryLabel =
      first?.category && String(first.category).trim().length > 0
        ? String(first.category).trim()
        : "diesem Bereich";

    const priceLabel = formatPrice(first);

    if (explanationMode === "ingredients") {
      if (hasDesc) {
        return (
          `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
          `Aus der Beschreibung:\n${snippet}\n\n` +
          "Die vollstÃ¤ndige, rechtlich verbindliche Zutatenliste findest du auf der Produktseite im Shop (Bereich â€Inhaltsstoffeâ€œ)."
        );
      }
      return (
        `Du fragst nach den Inhaltsstoffen von "${first.title}".\n\n` +
        "Im Katalog habe ich dazu keine Beschreibung. Die vollstÃ¤ndigen Inhaltsstoffe findest du normalerweise direkt auf der Produktseite im Shop."
      );
    }

    if (explanationMode === "materials") {
      if (hasDesc) {
        return (
          `Du mÃ¶chtest mehr Ã¼ber das Material von "${first.title}" wissen.\n\n` +
          `Aus der Beschreibung:\n${snippet}\n\n` +
          "Exakte Material-/Prozentangaben stehen meist auf der Produktseite (Produktdetails/Material)."
        );
      }
      return (
        `Du mÃ¶chtest mehr Ã¼ber das Material von "${first.title}" wissen.\n\n` +
        `Kategorie: "${categoryLabel}" â€“ Preis: ${priceLabel}.\n` +
        "Die exakte Materialzusammensetzung steht normalerweise auf der Produktseite im Shop."
      );
    }

    if (explanationMode === "usage") {
      if (hasDesc) {
        return (
          `Du mÃ¶chtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
          `Aus der Beschreibung:\n${snippet}\n\n` +
          "Weitere Details und Sicherheitshinweise findest du auf der Produktseite im Shop bzw. auf der Verpackung."
        );
      }
      return (
        `Du mÃ¶chtest wissen, wie man "${first.title}" am besten verwendet.\n\n` +
        `Kategorie: "${categoryLabel}" â€“ Preis: ${priceLabel}.\n` +
        "Details zur Anwendung findest du normalerweise auf der Produktseite im Shop. Wenn du mir sagst wofÃ¼r genau, gebe ich dir eine kurze Orientierung."
      );
    }

    // care / washing
    if (hasDesc) {
      return (
        `Du fragst nach Pflege- oder Waschhinweisen fÃ¼r "${first.title}".\n\n` +
        `Aus der Beschreibung:\n${snippet}\n\n` +
        "Bitte richte dich immer nach den offiziellen Angaben (Etikett/Produktseite)."
      );
    }
    return (
      `Du fragst nach Pflege- oder Waschhinweisen fÃ¼r "${first.title}".\n\n` +
      "Bitte richte dich nach den offiziellen Angaben auf dem Etikett bzw. auf der Produktseite im Shop."
    );
  }

  // Teuerstes Produkt (falls User explizit danach fragt)
  const wantsMostExpensive = detectMostExpensiveRequest(text);
  if (wantsMostExpensive) {
    const priced = recommended
      .map((p) => {
        const n = typeof p.price === "number" ? p.price : Number(p.price);
        return { p, n };
      })
      .filter((x) => Number.isFinite(x.n));

    const top = priced.length
      ? priced.sort((a, b) => b.n - a.n)[0].p
      : recommended[0];

    return (
      `Du legst Wert auf hohe QualitÃ¤t â€“ deshalb habe ich dir das teuerste Produkt aus dem Shop ausgesucht: "${top.title}". ` +
      `Dieses Produkt bietet dir in Material, Verarbeitung und Ausstattung das Maximum, was im Shop verfÃ¼gbar ist. ` +
      `Wenn du mÃ¶chtest, kann ich dir auch noch eine etwas gÃ¼nstigere Alternative zeigen, ` +
      `die trotzdem hochwertig ist â€“ falls du Preis und QualitÃ¤t ausbalancieren willst.`
    );
  }

  const hasCategory = !!(first.category && String(first.category).trim().length > 0);
  const scenarioId = detectProfisellerScenarioId({ count, hasBudget, hasCategory });

  // Profiseller Szenarien S1-S6
  switch (scenarioId) {
    case "S1": {
      const product = recommended[0];
      return (
        `Ich habe dir ein Produkt ausgesucht, das sehr gut zu deiner Anfrage passt: ` +
        `${product.title}. ` +
        `Es bietet dir ein starkes Preis-Leistungs-VerhÃ¤ltnis fÃ¼r deinen Wunsch. ` +
        `Wenn du mÃ¶chtest, kann ich dir auch noch eine oder zwei Alternativen im Ã¤hnlichen Preisbereich zeigen â€“ ` +
        `zum Beispiel, wenn dir eine bestimmte Marke oder ein bestimmtes Feature wichtiger ist.`
      );
    }

    case "S2": {
      const c = recommended.length;
      return (
        `Ich habe dir ${c === 2 ? "zwei" : `${c}`} passende Optionen herausgesucht, ` +
        `die gut zu deiner Anfrage passen. ` +
        `Unten im Produktbereich siehst du die VorschlÃ¤ge im Detail. ` +
        `Wenn du mir sagst, ob dir eher der Preis, die Marke oder bestimmte Features wichtig sind, ` +
        `kann ich dir auch gezielt eine klare Empfehlung aussprechen.`
      );
    }

    case "S3": {
      return (
        `Ich habe dir ${count} passende Produkte herausgesucht, ` +
        `damit du in Ruhe vergleichen kannst. ` +
        `Unten im Produktbereich siehst du die Auswahl mit allen wichtigen Details. ` +
        `Wenn du mir sagst, was dir besonders wichtig ist â€“ zum Beispiel Preis, Marke, bestimmte Features oder ein bestimmter Einsatzzweck â€“ ` +
        `kann ich die Liste fÃ¼r dich weiter eingrenzen und dir eine klare Empfehlung geben.`
      );
    }

    case "S4": {
      const budgetDisplay =
        budgetText ||
        (maxPrice !== null ? `bis etwa ${maxPrice} â‚¬` : minPrice !== null ? `ab etwa ${minPrice} â‚¬` : "");
      return (
        `Mit deinem Budget von ${budgetDisplay} habe ich dir unten passende Produkte eingeblendet.\n\n` +
        "Wenn du mir noch sagst, fÃ¼r welchen Bereich (z. B. Haushalt, Pflege, Tierbedarf), kann ich die Auswahl weiter eingrenzen."
      );
    }

    case "S5": {
      const categoryName =
        first.category && String(first.category).trim().length > 0 ? String(first.category) : "diesem Bereich";
      return (
        "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet.\n\n" +
        `Alle Produkte gehÃ¶ren in den Bereich ${categoryName}.\n\n` +
        "MÃ¶chtest du eher etwas GÃ¼nstiges fÃ¼r den Alltag oder eher eine Premiumnote?"
      );
    }

    case "S6": {
      return (
        `Zu deiner aktuellen Anfrage habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
        `Das liegt oft daran, dass entweder die Kategorie noch zu allgemein ist oder dein Wunsch sehr speziell ist. ` +
        `Wenn du mÃ¶chtest, versuche es bitte mit einer etwas genaueren Beschreibung ` +
        `(zum Beispiel: Produktart + Einsatzzweck + grober Preisrahmen), ` +
        `oder nenn mir eine andere Kategorie oder ein Budget, dann suche ich erneut fÃ¼r dich. ` +
        `Du kannst mir auch einfach sagen, ob du eher etwas GÃ¼nstiges, etwas Hochwertiges ` +
        `oder eine bestimmte Marke suchst â€“ dann kann ich dir gezielter helfen.`
      );
    }

    case "fallback":
    default:
      break;
  }

  // Budget-Fallback (nur wenn scenarioId fallback wÃ¤re)
  if (hasBudget && scenarioId === "fallback") {
    if (count === 1) {
      return (
        `Ich habe ein Produkt gefunden, das gut zu deinem Budget ${budgetText} passt:\n\n` +
        `â€¢ ${first.title} â€“ ${formatPrice(first)}\n\n` +
        "Wenn du mÃ¶chtest, kann ich dir noch eine Alternative im Ã¤hnlichen Preisbereich zeigen."
      );
    }

    const intro =
      `Ich habe mehrere Produkte passend zu deinem Budget ${budgetText} gefunden.\n\n` +
      `Ein sehr gutes Match ist:\n\n` +
      `â€¢ ${first.title} â€“ ${formatPrice(first)}\n\n` +
      "ZusÃ¤tzlich habe ich dir unten noch weitere passende Produkte eingeblendet:";

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title} â€“ ${formatPrice(p)}`);

    const closing =
      "\n\nWenn du dein Budget anpassen mÃ¶chtest (zum Beispiel etwas hÃ¶her oder niedriger), sag mir einfach kurz Bescheid.";

    return [intro, "", ...lines, closing].join("\n");
  }

  // Premium-Intent
  if (intent === "premium") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const qualityHint = " Ich habe Produkte ausgewÃ¤hlt, bei denen QualitÃ¤t im Vordergrund steht.";

    if (count === 1) {
      return (
        `Du legst Wert auf hohe QualitÃ¤t â€“ deshalb habe ich dir eine Premium-Variante ausgesucht: ` +
        `${first.title}. ` +
        `Dieses Produkt ist in Material, Verarbeitung und Ausstattung klar Ã¼ber dem Standard.` +
        (attributeHint || qualityHint) +
        ` Wenn du mÃ¶chtest, kann ich dir im nÃ¤chsten Schritt auch noch eine etwas gÃ¼nstigere Alternative zeigen, ` +
        `die trotzdem hochwertig ist â€“ falls du Preis und QualitÃ¤t ausbalancieren willst.`
      );
    }

    const intro =
      `Du legst Wert auf hohe QualitÃ¤t â€“ deshalb habe ich dir ${count} passende Premium-Optionen ausgesucht. ` +
      `Ein besonders starkes Match ist:` +
      (attributeHint || qualityHint);

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      `\n\nWenn du mÃ¶chtest, kann ich dir auch noch etwas gÃ¼nstigere Alternativen zeigen, ` +
      `die trotzdem hochwertig sind â€“ falls du Preis und QualitÃ¤t ausbalancieren willst.`;

    return [intro, "", `â€¢ ${first.title}`, "", ...lines, closing].join("\n");
  }

  // Bargain-Intent
  if (intent === "bargain") {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const priceHint = " Ich habe auf ein gutes Preis-Leistungs-VerhÃ¤ltnis geachtet.";

    const intro =
      `Du mÃ¶chtest ein gutes Angebot â€“ deshalb habe ich dir ` +
      `${count === 1 ? "eine besonders preiswerte Option" : `${count} passende, preisbewusste Optionen`} herausgesucht. ` +
      (attributeHint || priceHint);

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      `\n\nUnten im Produktbereich siehst du die VorschlÃ¤ge im Detail. ` +
      `Wenn du mir sagst, ob dir der absolut niedrigste Preis wichtiger ist oder ein gutes Preis-Leistungs-VerhÃ¤ltnis, ` +
      `kann ich dir noch gezielter die beste Empfehlung geben.`;

    return [intro, "", ...lines, closing].join("\n");
  }

  // Gift-Intent
  if (intent === "gift") {
    const intro =
      `Du suchst ein Geschenk â€“ sehr schÃ¶n. ` +
      `Ich habe dir ${count === 1 ? "eine passende Idee" : `${count} passende Geschenkideen`} herausgesucht.`;

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      `\n\nWenn du mir sagst, fÃ¼r wen das Geschenk ist (z. B. Alter, Interessen) und in welchem Preisrahmen du bleiben mÃ¶chtest, ` +
      `kann ich dir noch gezielter 1â€“2 Top-Empfehlungen nennen.`;

    return [intro, "", ...lines, closing].join("\n");
  }

  // Standard
  if (count === 1) {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    return (
      "Ich habe ein passendes Produkt fÃ¼r dich gefunden:\n\n" +
      `â€¢ ${first.title}${attributeHint}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  let attributeHint = "";
  if (attributeTerms.length > 0) {
    attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
  }

  const intro = "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:" + attributeHint;
  const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
  const closing =
    "\n\nWenn du mÃ¶chtest, helfe ich dir jetzt beim Eingrenzen â€“ zum Beispiel nach Preisbereich, Kategorie oder Einsatzzweck.";

  return [intro, "", ...lines, closing].join("\n");
}

export function buildReplyTextWithAiClarify(
  baseReplyText: string,
  aiTrigger?: SellerBrainAiTrigger,
  finalCount?: number
): string {
  if (!aiTrigger || !aiTrigger.needsAiHelp) return baseReplyText;

  const terms = (aiTrigger.unknownTerms ?? []).filter(Boolean);
  const termsSnippet = terms.length ? ` ${terms.join(", ")}` : "";
  const hasProducts = (finalCount ?? 0) > 0;

  let clarification = "";

  if (aiTrigger.reason === "no_results") {
    clarification =
      terms.length > 0
        ? `\n\nIch finde zu folgendem Begriff nichts im Katalog:${termsSnippet}. ` +
          `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
          `Sag mir bitte kurz: Produktart + grober Preisrahmen.`
        : `\n\nIch habe zu deiner Beschreibung keine passenden Produkte gefunden. ` +
          `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
          `Sag mir bitte kurz: Produktart + grober Preisrahmen.`;
  } else {
    if (hasProducts) {
      clarification =
        terms.length > 0
          ? `\n\nEinige deiner Begriffe kann ich im Katalog nicht zuordnen:${termsSnippet}. ` +
            `Die VorschlÃ¤ge unten passen grob zu deiner Anfrage. ` +
            `Wenn du mir sagst, was dir am wichtigsten ist (Preis, Marke, Feature), picke ich dir 1â€“2 Top-Empfehlungen raus.`
          : `\n\nDie VorschlÃ¤ge unten passen grob zu deiner Anfrage. ` +
            `Wenn du mir sagst, was dir am wichtigsten ist (Preis, Marke, Feature), picke ich dir 1â€“2 Top-Empfehlungen raus.`;
    } else {
      clarification =
        terms.length > 0
          ? `\n\nEinige deiner Begriffe kann ich im Katalog nicht zuordnen:${termsSnippet}. ` +
            `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details (Produktart + grober Preisrahmen).`
          : `\n\nDamit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details (Produktart + grober Preisrahmen).`;
    }
  }

  return `${baseReplyText.trim()}\n\n${clarification.trim()}`;
}

export function buildReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[],
  aiTrigger?: SellerBrainAiTrigger,
  priceRangeNoMatch?: boolean,
  priceRangeInfo?: {
    userMinPrice: number | null;
    userMaxPrice: number | null;
    categoryMinPrice: number | null;
    categoryMaxPrice: number | null;
    category?: string | null;
  },
  missingCategoryHint?: string,
  replyMode?: "customer" | "operator",
  storeFacts?: StoreFacts
): string {
  const effectiveReplyMode: "customer" | "operator" = replyMode ?? "operator";

  // KB-Shortcut: nur Customer-Mode, nur wenn Facts existieren (kbRoute ist sonst No-Op).
  if (effectiveReplyMode !== "operator" && storeFacts) {
    const kb = kbRoute(text, storeFacts);
    if (kb) return kb.answer;
  }
  if (priceRangeNoMatch && priceRangeInfo) {
    const { userMinPrice, userMaxPrice } = priceRangeInfo;

    let requestedRange = "deinem gewÃ¼nschten Preisbereich";
    if (userMinPrice !== null && userMaxPrice === null) requestedRange = `Ã¼ber ${userMinPrice} â‚¬`;
    else if (userMaxPrice !== null && userMinPrice === null) requestedRange = `unter ${userMaxPrice} â‚¬`;
    else if (userMinPrice !== null && userMaxPrice !== null)
      requestedRange = `zwischen ${userMinPrice} â‚¬ und ${userMaxPrice} â‚¬`;

    return (
      `In ${requestedRange} habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
      `Ich habe dir stattdessen VorschlÃ¤ge gezeigt, die dem, was du suchst, am nÃ¤chsten kommen. ` +
      `Wenn du dein Budget ein wenig anpassen kannst, kann ich dir eine deutlich bessere Auswahl empfehlen.`
    );
  }

  if (missingCategoryHint) {
    const categoryLabel = missingCategoryHint;
    const normalizedHint = normalize(categoryLabel);

    let alternativeCategory =
      recommended.length > 0 && recommended[0].category ? String(recommended[0].category) : "Produkte";

    if (normalizedHint.includes("pflege")) {
      const cosmetics = recommended.find((p) => normalize(p.category || "").includes("kosmetik"));
      if (cosmetics?.category) alternativeCategory = String(cosmetics.category);
    }

    let clarifyText = `In deinem Katalog finde ich nur ${alternativeCategory}, aber keine ${categoryLabel}. Ich zeige dir die ${alternativeCategory.toLowerCase()}.`;

    if (effectiveReplyMode === "operator") {
      clarifyText +=
        `\n\nHinweis fÃ¼r den Shop-Betreiber: In deinem Katalog gibt es aktuell keine ${categoryLabel} â€“ nur ${alternativeCategory} und ZubehÃ¶r. ` +
        `Wenn du ${categoryLabel} verkaufen mÃ¶chtest, solltest du entsprechende Produkte/Kategorien anlegen.`;
    }

    if (recommended.length > 0) {
      const baseText = buildRuleBasedReplyText(text, intent, recommended);
      return `${clarifyText}\n\n${baseText}`;
    }
    return clarifyText;
  }

  if (aiTrigger?.reason === "unknown_product_code_only") {
    const codeTerm =
      aiTrigger.codeTerm ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms.find((t) => looksLikeProductCode(t))) ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms[0]) ||
      null;

    const codeLabel = codeTerm ? `"${codeTerm}"` : "diesen Code";

    return (
      `Ich konnte den Code ${codeLabel} in diesem Shop nicht finden.\n\n` +
      `Sag mir bitte, was fÃ¼r ein Produkt du suchst â€“ zum Beispiel eine Kategorie, eine Marke oder ein Einsatzgebiet. ` +
      `Dann zeige ich dir gezielt passende Produkte.`
    );
  }

  if (aiTrigger?.reason === "ambiguous_budget") {
    return (
      `Du hast erwÃ¤hnt, dass dein Budget eher klein ist. Damit ich dir wirklich passende Produkte empfehlen kann:\n\n` +
      `â€¢ FÃ¼r welche Art von Produkt suchst du etwas?\n` +
      `â€¢ Und ungefÃ¤hr mit welchem Betrag mÃ¶chtest du rechnen?`
    );
  }

  if (aiTrigger?.reason === "missing_category_for_budget") {
    return (
      `Alles klar, du hast ein Budget genannt. FÃ¼r welche Art von Produkt suchst du etwas â€“ ` +
      `z. B. Haushalt, Pflege, Tierbedarf oder etwas anderes?`
    );
  }

  const baseReplyText = buildRuleBasedReplyText(text, intent, recommended);
  return buildReplyTextWithAiClarify(baseReplyText, aiTrigger, recommended.length);
}

export function trimClarifyBlock(replyText: string | null | undefined): string {
  if (!replyText) return "";
  const marker = "Einige deiner Begriffe kann ich im Katalog nicht zuordnen";
  const idx = replyText.indexOf(marker);
  if (idx === -1) return replyText.trim();
  return replyText.slice(0, idx).trim();
}

