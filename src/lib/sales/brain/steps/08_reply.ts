// src/lib/sales/brain/steps/08_reply.ts
// WICHTIG: 1:1 aus orchestrator.ts übernehmen – KEINE Logik ändern.

import { detectMostExpensiveRequest } from "../../intent";
import { extractUserPriceRange } from "../../budget";
import { detectExplanationModeBoolean } from "../../intent/explanationMode";
import { QUERY_STOPWORDS, ATTRIBUTE_PHRASES, ATTRIBUTE_KEYWORDS } from "../../languageRules.de";


type ProductAttributeMap = Record<string, string[]>;

type ParsedQuery = {
  coreTerms: string[];
  attributeTerms: string[];
  attributeFilters: ProductAttributeMap;
};

function normalizeText(input: string): string {
  return (input ?? "")
    .toLowerCase()
    // Umlaute/ß bewusst behalten
    .replace(/[^a-z0-9äöüß\s]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseQueryForAttributes(text: string): ParsedQuery {
  const normalized = normalizeText(text);
  const stopwords = QUERY_STOPWORDS;

  const attributePhrases = ATTRIBUTE_PHRASES;
  const foundPhrases: string[] = [];
  let remainingText = normalized;

  for (const phrase of attributePhrases) {
    if (remainingText.includes(phrase)) {
      foundPhrases.push(phrase);
      remainingText = remainingText.replace(phrase, " ");
    }
  }

  const remainingTokens = remainingText
    .split(" ")
    .filter((t) => t.length >= 3 && !stopwords.includes(t));

  const attributeKeywords = ATTRIBUTE_KEYWORDS;

  const attributeTerms: string[] = [...foundPhrases];
  const coreTerms: string[] = [];

  for (const token of remainingTokens) {
    if (
      attributeKeywords.includes(token) ||
      foundPhrases.some((p) => p.includes(token))
    ) {
      if (!attributeTerms.includes(token)) attributeTerms.push(token);
    } else {
      coreTerms.push(token);
    }
  }

  const attributeFilters: ProductAttributeMap = {};

  function addFilter(key: string, value: string): void {
    if (!attributeFilters[key]) attributeFilters[key] = [];
    if (!attributeFilters[key].includes(value)) attributeFilters[key].push(value);
  }

  // (Optional) hier kannst du später die ganzen addFilter(...) Regeln ergänzen,
  // wenn du sie im Reply-Step wirklich brauchst. Für den aktuellen Crash ist das NICHT nötig.

  return { coreTerms, attributeTerms, attributeFilters };
}

function getDescriptionSnippet(input: any, maxLen = 140): string {
  // Akzeptiert entweder:
  // - string (Beschreibung)
  // - Objekt mit .description (Produkt)
  let raw = "";

  if (typeof input === "string") raw = input;
  else if (input && typeof input.description === "string") raw = input.description;
  else if (input && typeof input.descriptionHtml === "string") raw = input.descriptionHtml;

  if (!raw) return "";

  // HTML tags entfernen
  let text = raw.replace(/<[^>]*>/g, " ");

  // Entities minimal entschärfen
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  // Whitespace normalisieren
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "";

  // Auf maxLen kürzen
  if (text.length <= maxLen) return text;

  const cut = text.slice(0, maxLen);

  // Nicht mitten im Wort abschneiden (wenn möglich)
  const lastSpace = cut.lastIndexOf(" ");
  const safe = lastSpace >= 40 ? cut.slice(0, lastSpace) : cut;

  return safe.trim() + "…";
}

function detectProfisellerScenario(input: any): boolean {
  // Unterstützt verschiedene Call-Sites:
  // - detectProfisellerScenario(text: string)
  // - detectProfisellerScenario(state/context/scenarioObj)
  let s = "";

  if (typeof input === "string") {
    s = input;
  } else if (input && typeof input.scenarioName === "string") {
    s = input.scenarioName;
  } else if (input && typeof input.scenarioId === "string") {
    s = input.scenarioId;
  } else if (input && typeof input.testName === "string") {
    s = input.testName;
  } else if (input && typeof input.label === "string") {
    s = input.label;
  } else if (input && typeof input.text === "string") {
    // falls jemand aus Versehen state/text übergibt
    s = input.text;
  }

  const t = (s || "").toLowerCase();

  // “Profi”-Modus Trigger: entweder explizit in Szenario/Label oder im Text
  return /\b(profi|profiseller|professional|enterprise|b2b|agentur|beratung|sales)\b/.test(t);
}

function normalize(input: string | null | undefined): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}




export function buildRuleBasedReplyText(
  text: string,
  intent: ShoppingIntent,
  recommended: EfroProduct[],
  plan?: string
): string {
  const count = recommended.length;

  // S6: ZERO RESULTS wird hier behandelt, aber Szenario-Erkennung erfolgt sp?ter
  // (unknown_product_code_only wird bereits in buildReplyText behandelt)
  if (count === 0) {
    // S6-Text wird sp?ter im switch-case verwendet, hier nur Fallback
    return (
      `Zu deiner aktuellen Anfrage habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
      `Das liegt oft daran, dass entweder die Kategorie noch zu allgemein ist oder dein Wunsch sehr speziell ist. ` +
      `Wenn du möchtest, versuche es bitte mit einer etwas genaueren Beschreibung ` +
      `(zum Beispiel: Produktart + Einsatzzweck + grober Preisrahmen), ` +
      `oder nenn mir eine andere Kategorie oder ein Budget, dann suche ich erneut für dich. ` +
      `Du kannst mir auch einfach sagen, ob du eher etwas Günstiges, etwas Hochwertiges ` +
      `oder eine bestimmte Marke suchst – dann kann ich dir gezielter helfen.`
    );
  }

  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "€";

  const first = recommended[0];

  // Pr?fe, ob User explizit nach dem teuersten Produkt fragt
  const wantsMostExpensive = detectMostExpensiveRequest(text);

  // Spezialfall: "Teuerstes Produkt" mit gefundenen Produkten
  if (wantsMostExpensive && count > 0) {
    const top = recommended[0];
    return (
      `Du legst Wert auf hohe Qualität – deshalb habe ich dir das teuerste Produkt aus dem Shop ausgesucht: "${top.title}". ` +
      `Dieses Produkt bietet dir in Material, Verarbeitung und Ausstattung das Maximum, was im Shop verfügbar ist. ` +
      `Wenn du möchtest, kann ich dir auch noch eine etwas günstigere Alternative zeigen, ` +
      `die trotzdem hochwertig ist – falls du Preis und Qualität ausbalancieren willst.`
    );
  }

  const { minPrice, maxPrice } = extractUserPriceRange(text);
  const hasBudget = minPrice !== undefined || maxPrice !== undefined;

  const explanationMode = detectExplanationModeBoolean(text);


  // Attribute-Terms aus Query extrahieren
  const parsed = parseQueryForAttributes(text);
  const { attributeTerms } = parsed;

  const descSnippet = getDescriptionSnippet(first.description);
  const hasDesc = !!descSnippet;

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

  // Szenario-Erkennung f?r Profiseller-Engine
  const scenario = detectProfisellerScenario(
    text,
    intent,
    count,
    hasBudget,
    minPrice ?? null,
    maxPrice ?? null,
    attributeTerms
  );

  console.log("[EFRO Profiseller] scenario", {
    text: text.substring(0, 100),
    intent,
    finalCount: count,
    scenario,
    hasBudget,
    minPrice,
    maxPrice,
  });

  // 0) Spezialf?lle: Erkl?r-Modus (hat Priorit?t vor Profiseller-Szenarien)
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
          "Die exakte Liste der Inhaltsstoffe wird direkt im Shop auf der Produktseite gepflegt ? dort findest du alle Details, inklusive gesetzlich vorgeschriebener Angaben.\n\n" +
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
   * Profiseller-Szenarien S1-S6
   */
  switch (scenario) {
    case "S1": {
      // QUICK BUY ? EIN klares Produkt
      const product = recommended[0];
      return (
        `Ich habe dir ein Produkt ausgesucht, das sehr gut zu deiner Anfrage passt: ` +
        `${product.title}. ` +
        `Es bietet dir ein starkes Preis-Leistungs-Verhältnis für deinen Wunsch. ` +
        `Wenn du möchtest, kann ich dir auch noch eine oder zwei Alternativen im ähnlichen Preisbereich zeigen – ` +
        `zum Beispiel, wenn dir eine bestimmte Marke oder ein bestimmtes Feature wichtiger ist.`
      );
    }

    case "S2": {
      // QUICK BUY ? WENIGE Optionen (2-4)
      const priceRange = (() => {
        const prices = recommended
          .map((p) => p.price)
          .filter((p): p is number => p != null);
        if (prices.length === 0) return null;
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        if (min === max) return `${min.toFixed(2)} €`;
        return `${min.toFixed(2)} € – ${max.toFixed(2)} €`;
      })();

      const priceInfo = priceRange ? ` (Preisbereich: ${priceRange})` : "";
      const topProducts = recommended.slice(0, 3).map((p) => {
        const price = p.price != null ? ` – ${formatPrice(p)}` : "";
        return `• ${p.title}${price}`;
      });

      const count = recommended.length;
      return (
        `Ich habe dir ${count === 2 ? "zwei" : `${count}`} passende Optionen herausgesucht, ` +
        `die gut zu deiner Anfrage passen. ` +
        `Unten im Produktbereich siehst du die Vorschläge im Detail. ` +
        `Wenn du eine schnelle Entscheidung treffen willst, schau dir zuerst das Produkt mit dem besten Preis-Leistungs-Verhältnis an ` +
        `und danach die Variante, die etwas hochwertiger ist. ` +
        `Wenn du mir sagst, ob dir eher der Preis, die Marke oder bestimmte Features wichtig sind, ` +
        `kann ich dir auch gezielt eine klare Empfehlung aussprechen.`
      );
    }

    case "S3": {
      // EXPLORE ? Mehrere Produkte (>= 3)
      return (
        `Ich habe dir ${count} passende Produkte herausgesucht, ` +
        `damit du in Ruhe vergleichen kannst. ` +
        `Unten im Produktbereich siehst du die Auswahl mit allen wichtigen Details. ` +
        `Wenn du mir sagst, was dir besonders wichtig ist – zum Beispiel Preis, Marke, bestimmte Features oder ein bestimmter Einsatzzweck – ` +
        `kann ich die Liste für dich weiter eingrenzen und dir eine klare Empfehlung geben.`
      );
    }

    case "S4": {
      // BUDGET-ONLY ANFRAGE
      const budgetDisplay = budgetText || (maxPrice ? `bis etwa ${maxPrice} €` : minPrice ? `ab etwa ${minPrice} €` : "");
      return (
        `Mit deinem Budget von ${budgetDisplay} habe ich dir unten passende Produkte eingeblendet.\n\n` +
        "Wenn du mir noch sagst, für welchen Bereich (z. B. Haushalt, Pflege, Tierbedarf), kann ich die Auswahl weiter eingrenzen."
      );
    }

    case "S5": {
      // ONLY CATEGORY / MARKENANFRAGE
      const categoryName = first.category && first.category.trim().length > 0
        ? first.category
        : "diesem Bereich";
      return (
        "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet.\n\n" +
        `Alle Produkte gehören in den Bereich ${categoryName}.\n\n` +
        "Möchtest du eher etwas Günstiges für den Alltag oder eher eine Premiumnote?"
      );
    }

    case "S6": {
      // ZERO RESULTS (kein unknown_product_code_only)
      return (
        `Zu deiner aktuellen Anfrage habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
        `Das liegt oft daran, dass entweder die Kategorie noch zu allgemein ist oder dein Wunsch sehr speziell ist. ` +
        `Wenn du möchtest, versuche es bitte mit einer etwas genaueren Beschreibung ` +
        `(zum Beispiel: Produktart + Einsatzzweck + grober Preisrahmen), ` +
        `oder nenn mir eine andere Kategorie oder ein Budget, dann suche ich erneut für dich. ` +
        `Du kannst mir auch einfach sagen, ob du eher etwas Günstiges, etwas Hochwertiges ` +
        `oder eine bestimmte Marke suchst – dann kann ich dir gezielter helfen.`
      );
    }

    case "fallback":
    default: {
      // Bestehendes Verhalten f?r alle anderen F?lle
      break;
    }
  }

  /**
   * 1) F?lle mit explizitem Budget im Text (Fallback, wenn nicht S4)
   */
  if (hasBudget && scenario === "fallback") {
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
      `? ${first.title} ? ${formatPrice(first)}\n\n` +
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
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint =
        ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const qualityHint =
      " Ich habe Produkte ausgewählt, bei denen Qualität im Vordergrund steht.";

    if (count === 1) {
      return (
        `Du legst Wert auf hohe Qualität – deshalb habe ich dir eine Premium-Variante ausgesucht: ` +
        `${first.title}. ` +
        `Dieses Produkt ist in Material, Verarbeitung und Ausstattung klar über dem Standard. ` +
        (attributeHint || qualityHint) +
        ` Wenn du möchtest, kann ich dir im nächsten Schritt auch noch eine etwas günstigere Alternative zeigen, ` +
        `die trotzdem hochwertig ist – falls du Preis und Qualität ausbalancieren willst.`
      );
    }

    const intro =
      `Du legst Wert auf hohe Qualität – deshalb habe ich dir ${count} passende Premium-Optionen ausgesucht. ` +
      `Diese Produkte sind in Material, Verarbeitung und Ausstattung klar über dem Standard. ` +
      (attributeHint || qualityHint) +
      ` Ein besonders starkes Match ist:`;

    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);

    const closing =
      `\n\nWenn du möchtest, kann ich dir auch noch etwas günstigere Alternativen zeigen, ` +
      `die trotzdem hochwertig sind – falls du Preis und Qualität ausbalancieren willst.`;

    return [intro, "", `• ${first.title}`, "", ...lines, closing].join("\n");
  }

  /**
   * 3) Bargain-Intent ohne Budget
   */
  if (intent === "bargain") {
    const count = recommended.length;
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    const priceHint =
      " Ich habe auf ein gutes Preis-Leistungs-Verhältnis geachtet.";

    const intro =
      `Du möchtest ein gutes Angebot – deshalb habe ich dir ` +
      `${count === 1 ? "eine besonders preiswerte Option" : `${count} passende, preisbewusste Optionen`} herausgesucht. ` +
      `Dabei achte ich nicht nur auf den niedrigsten Preis, sondern auch darauf, dass Qualität und Nutzen stimmen. ` +
      (attributeHint || priceHint);
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      `\n\nUnten im Produktbereich siehst du die Vorschläge im Detail. ` +
      `Wenn du mir sagst, ob dir der absolut niedrigste Preis wichtiger ist oder ein gutes Preis-Leistungs-Verhältnis, ` +
      `kann ich dir noch gezielter die beste Empfehlung geben. ` +
      `Wenn du möchtest, kann ich dir zusätzlich auch noch eine etwas hochwertigere Alternative zeigen, ` +
      `die nur wenig teurer ist, aber bei Ausstattung oder Haltbarkeit mehr bietet.`;

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 4) Geschenk-Intent
   */
  if (intent === "gift") {
    const count = recommended.length;
    const intro =
      `Du suchst ein Geschenk – sehr schön. ` +
      `Ich habe dir ${count === 1 ? "eine passende Idee" : `${count} passende Geschenkideen`} herausgesucht, ` +
      `die sich gut zum Verschenken eignen. ` +
      `Unten im Produktbereich siehst du die Vorschläge mit den wichtigsten Infos.`;
    const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
    const closing =
      `\n\nWenn du mir sagst, für wen das Geschenk ist (z. B. Alter, Beziehung, Interessen) und in welchem Preisrahmen du bleiben möchtest, ` +
      `kann ich dir noch gezielter 1–2 Top-Empfehlungen nennen. ` +
      `Wenn du möchtest, kann ich dir auch noch helfen, zwischen "sicheren Klassikern" und etwas ausgefalleneren Ideen zu unterscheiden, ` +
      `damit du genau den richtigen Ton triffst.`;

    return [intro, "", ...lines, closing].join("\n");
  }

  /**
   * 5) Standard-Fälle (explore / quick_buy / bundle ...)
   */
  if (count === 1) {
    let attributeHint = "";
    if (attributeTerms.length > 0) {
      attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
    }
    return (
      "Ich habe ein passendes Produkt für dich gefunden:\n\n" +
      `• ${first.title}${attributeHint}\n\n` +
      "Unten siehst du alle Details. Wenn dir etwas daran nicht ganz passt, sag mir einfach, worauf du besonders Wert legst (z. B. Preis, Marke oder Kategorie)."
    );
  }

  let attributeHint = "";
  if (attributeTerms.length > 0) {
    attributeHint = ` Ich habe auf folgende Kriterien geachtet: ${attributeTerms.join(", ")}.`;
  }

  const intro =
    "Ich habe dir unten eine Auswahl an passenden Produkten eingeblendet:" +
    attributeHint;
  const lines = recommended.map((p, idx) => `${idx + 1}. ${p.title}`);
  const closing =
    "\n\nWenn du möchtest, helfe ich dir jetzt beim Eingrenzen – zum Beispiel nach Preisbereich, Kategorie oder Einsatzzweck.";

  return [intro, "", ...lines, closing].join("\n");
}



export function buildReplyTextWithAiClarify(
  baseReplyText: string,
  aiTrigger?: SellerBrainAiTrigger,
  finalCount?: number
): string {
  if (!aiTrigger || !aiTrigger.needsAiHelp) {
    return baseReplyText;
  }

  const terms = (aiTrigger.unknownTerms ?? []).filter(Boolean);
  const termsSnippet = terms.length ? ` ${terms.join(", ")}` : "";
  const hasProducts = (finalCount ?? 0) > 0;

  let clarification = "";

  if (aiTrigger.reason === "no_results") {
    if (terms.length > 0) {
      clarification = `\n\nIch finde zu folgendem Begriff nichts im Katalog:${termsSnippet}. ` +
        `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
        `Sag mir zum Beispiel kurz, um welche Art Produkt es dir genau geht und in welchem Preisrahmen du ungefähr bleiben möchtest.`;
    } else {
      clarification = `\n\nIch habe zu deiner Beschreibung keine passenden Produkte gefunden. ` +
        `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
        `Sag mir zum Beispiel kurz, um welche Art Produkt es dir genau geht und in welchem Preisrahmen du ungefähr bleiben möchtest. ` +
        `Du kannst z. B. sagen: "Zeig mir etwas Günstiges für jeden Tag" oder "Lieber etwas Hochwertiges, das lange hält".`;
    }
  } else {
    if (hasProducts) {
      // Produkte wurden gefunden, aber AI will noch nachfragen
      if (terms.length > 0) {
        clarification = `\n\nEinige deiner Begriffe kann ich im Katalog nicht zuordnen:${termsSnippet}. ` +
          `Die Vorschläge unten passen grob zu deiner Anfrage. ` +
          `Wenn du mir jetzt noch sagst, was dir am wichtigsten ist (z. B. Preis, Marke, bestimmte Eigenschaft), ` +
          `kann ich dir daraus 1–2 besonders passende Empfehlungen herauspicken.`;
      } else {
        clarification = `\n\nDie Vorschläge unten passen grob zu deiner Anfrage. ` +
          `Wenn du mir jetzt noch sagst, was dir am wichtigsten ist (z. B. Preis, Marke, bestimmte Eigenschaft), ` +
          `kann ich dir daraus 1–2 besonders passende Empfehlungen herauspicken.`;
      }
    } else {
      // Keine Produkte gefunden, aber nicht "no_results"
      if (terms.length > 0) {
        clarification = `\n\nEinige deiner Begriffe kann ich im Katalog nicht zuordnen:${termsSnippet}. ` +
          `Damit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
          `Sag mir zum Beispiel kurz, um welche Art Produkt es dir genau geht und in welchem Preisrahmen du ungefähr bleiben möchtest.`;
      } else {
        clarification = `\n\nDamit ich dir wirklich passende Produkte vorschlagen kann, brauche ich noch ein, zwei Details von dir. ` +
          `Sag mir zum Beispiel kurz, um welche Art Produkt es dir genau geht und in welchem Preisrahmen du ungefähr bleiben möchtest. ` +
          `Du kannst z. B. sagen: "Zeig mir etwas Günstiges für jeden Tag" oder "Lieber etwas Hochwertiges, das lange hält".`;
      }
    }
  }

  // Optional: Wenn wirklich gar keine Produkte gefunden wurden,
  // kannst du den Basetext sp?ter k?rzen. F?r jetzt h?ngen wir
  // nur die Kl?rung sauber an.
  const combined = `${baseReplyText.trim()}\n\n${clarification.trim()}`;

  console.log("[EFRO ReplyText AI-Clarify]", {
    reason: aiTrigger.reason,
    needsAiHelp: aiTrigger.needsAiHelp,
    unknownTerms: aiTrigger.unknownTerms,
    finalReplyText: combined,
  });

  return combined;
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
  replyMode?: "customer" | "operator"
): string {
  const effectiveReplyMode: "customer" | "operator" = replyMode ?? "operator";
  
  console.log("[EFRO ReplyText] mode='rule-based'", {
    intent,
    recommendedCount: recommended.length,
    priceRangeNoMatch,
    missingCategoryHint,
    replyMode: effectiveReplyMode,
  });

  // EFRO Budget-Fix 2025-11-30 ? PriceRangeNoMatch Reply: Ehrliche Kommunikation, wenn kein Produkt im gew?nschten Preisbereich
  // WICHTIG: Bei priceRangeNoMatch NUR den speziellen Text zur?ckgeben, KEIN zus?tzlicher Standard-Budget-Text
  if (priceRangeNoMatch && priceRangeInfo) {
    const { userMinPrice, userMaxPrice, categoryMinPrice, categoryMaxPrice, category } = priceRangeInfo;
    
    let priceRangeText = "";
    if (userMinPrice !== null && userMaxPrice === null) {
      priceRangeText = `über ${userMinPrice} €`;
    } else if (userMaxPrice !== null && userMinPrice === null) {
      priceRangeText = `unter ${userMaxPrice} €`;
    } else if (userMinPrice !== null && userMaxPrice !== null) {
      priceRangeText = `zwischen ${userMinPrice} € und ${userMaxPrice} €`;
    }
    
    const categoryLabel = category ? category : "Produkte";
    
    // EFRO Budget-Fix 2025-11-30: Sauberer, kurzer Text ohne zus?tzliche Budget-Formulierungen
    let clarifyText = "";
    const requestedRange = priceRangeText || "deinem gewünschten Preisbereich";
    if (userMinPrice !== null && userMaxPrice === null) {
      // "?ber X" = Untergrenze, aber nichts gefunden
      clarifyText =
        `In ${requestedRange} habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
        `Ich habe dir stattdessen Vorschläge gezeigt, die dem, was du suchst, am nächsten kommen. ` +
        `Wenn du dein Budget ein wenig nach oben oder unten anpassen kannst, ` +
        `kann ich dir eine deutlich bessere Auswahl empfehlen. ` +
        `Sag mir einfach, ob dir eher ein möglichst günstiger Preis oder bestimmte Qualität/Marken wichtiger sind, ` +
        `dann finde ich die beste Option für dich.`;
    } else if (userMaxPrice !== null && userMinPrice === null) {
      // "unter X" = Obergrenze, aber nichts gefunden
      clarifyText =
        `In ${requestedRange} habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
        `Ich habe dir stattdessen Vorschläge gezeigt, die dem, was du suchst, am nächsten kommen. ` +
        `Wenn du dein Budget ein wenig nach oben oder unten anpassen kannst, ` +
        `kann ich dir eine deutlich bessere Auswahl empfehlen. ` +
        `Sag mir einfach, ob dir eher ein möglichst günstiger Preis oder bestimmte Qualität/Marken wichtiger sind, ` +
        `dann finde ich die beste Option für dich.`;
    } else {
      // Bereich oder allgemein
      clarifyText =
        `In ${requestedRange} habe ich in diesem Shop leider keine passenden Produkte gefunden. ` +
        `Ich habe dir stattdessen Vorschläge gezeigt, die dem, was du suchst, am nächsten kommen. ` +
        `Wenn du dein Budget ein wenig nach oben oder unten anpassen kannst, ` +
        `kann ich dir eine deutlich bessere Auswahl empfehlen. ` +
        `Sag mir einfach, ob dir eher ein möglichst günstiger Preis oder bestimmte Qualität/Marken wichtiger sind, ` +
        `dann finde ich die beste Option für dich.`;
    }
    
    console.log("[EFRO ReplyText PriceRangeNoMatch]", {
      priceRangeNoMatch,
      priceRangeInfo,
      clarifyTextLength: clarifyText.length,
      note: "Nur spezieller Text, kein zus?tzlicher Standard-Budget-Text",
    });
    
    // EFRO Budget-Fix 2025-11-30: Direkt zur?ckgeben, KEIN zus?tzlicher baseText
    return clarifyText;
  }

  // EFRO Budget-Fix 2025-11-30: Spezialfall: Fehlende Kategorie (z. B. "Bindungen" nicht im Katalog)
  if (missingCategoryHint) {
    const categoryLabel = missingCategoryHint;
    
    // EFRO S9 Fix: "pflege" soll auf "kosmetik" gemappt werden, nicht auf zuf?llige Kategorie
    const normalizedHint = normalize(categoryLabel);
    let alternativeCategory = recommended.length > 0 && recommended[0].category 
      ? recommended[0].category 
      : "Produkte";
    
    // Spezielle Fallback-Mappings f?r h?ufige Kategorien
    if (normalizedHint === "pflege" || normalizedHint.includes("pflege")) {
      // Pr?fe, ob "kosmetik" im Katalog existiert
      const hasCosmetics = recommended.some((p) => 
        normalize(p.category || "").includes("kosmetik") || 
        normalize(p.category || "").includes("cosmetic")
      );
      if (hasCosmetics) {
        alternativeCategory = recommended.find((p) => 
          normalize(p.category || "").includes("kosmetik") || 
          normalize(p.category || "").includes("cosmetic")
        )?.category || alternativeCategory;
      }
    }
    
    let clarifyText = `In deinem Katalog finde ich nur ${alternativeCategory}, aber keine ${categoryLabel}. Ich zeige dir die ${alternativeCategory.toLowerCase()}.`;
    
    // Hinweis für den Shop-Betreiber nur im Operator-Modus anzeigen
    if (effectiveReplyMode === "operator") {
      clarifyText += `\n\nHinweis für den Shop-Betreiber: In deinem Katalog gibt es aktuell keine ${categoryLabel} – nur ${alternativeCategory} und Zubehör. ` +
        `Wenn du ${categoryLabel} verkaufen möchtest, solltest du entsprechende Produkte/Kategorien anlegen.`;
    }
    
    console.log("[EFRO ReplyText MissingCategory]", {
      missingCategoryHint,
      alternativeCategory,
      clarifyTextLength: clarifyText.length,
      replyMode: effectiveReplyMode,
    });
    
    // Wenn Produkte vorhanden sind, f?ge den Hinweis zum normalen Text hinzu
    if (recommended.length > 0) {
      const baseText = buildRuleBasedReplyText(text, intent, recommended);
      return `${clarifyText}\n\n${baseText}`;
    }
    
    return clarifyText;
  }

  // Spezialfall: Nutzer nennt einen unbekannten Produktcode wie "ABC123"
  if (aiTrigger?.reason === "unknown_product_code_only") {
    const codeTerm =
      aiTrigger.codeTerm ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms.find((t) => looksLikeProductCode(t))) ||
      (aiTrigger.unknownTerms && aiTrigger.unknownTerms[0]) ||
      null;

    const codeLabel = codeTerm ? `"${codeTerm}"` : "diesen Code";

    const clarifyText =
      `Ich konnte den Code ${codeLabel} in diesem Shop nicht finden.\n\n` +
      `Sag mir bitte, was für ein Produkt du suchst – zum Beispiel eine Kategorie (Haushalt, Pflege, Tierbedarf), ` +
      `eine Marke oder ein bestimmtes Einsatzgebiet.\n` +
      `Dann zeige ich dir gezielt passende Produkte.`;

    console.log("[EFRO ReplyText UnknownCode]", {
      reason: aiTrigger.reason,
      codeTerm,
      clarifyTextLength: clarifyText.length,
    });

    return clarifyText;
  }

  // EFRO Budget-Fix 2025-01-XX: Spezialfall - Vages Budget ohne konkrete Zahl
  if (aiTrigger?.reason === "ambiguous_budget") {
    const clarifyText =
      `Du hast erwähnt, dass dein Budget eher klein ist. Damit ich dir wirklich passende Produkte empfehlen kann:\n\n` +
      `? Für welche Art von Produkt suchst du etwas (z. B. Snowboard, Haustier, Parfüm, Haushalt)?\n` +
      `? Und ungefähr mit welchem Betrag möchtest du rechnen?`;

    console.log("[EFRO ReplyText AmbiguousBudget]", {
      reason: aiTrigger.reason,
      clarifyTextLength: clarifyText.length,
    });

    return clarifyText;
  }

  // EFRO Budget-Fix 2025-01-XX: Spezialfall - Budget mit Zahl, aber ohne Kategorie
  if (aiTrigger?.reason === "missing_category_for_budget") {
    const clarifyText =
      `Alles klar, du hast ein Budget genannt. Für welche Art von Produkt suchst du etwas – ` +
      `z. B. Snowboard, Haustier-Produkte, Parfüm oder etwas für den Haushalt?`;

    console.log("[EFRO ReplyText MissingCategoryForBudget]", {
      reason: aiTrigger.reason,
      clarifyTextLength: clarifyText.length,
    });

    return clarifyText;
  }

  // Regel-basierte Logik
  const baseReplyText = buildRuleBasedReplyText(text, intent, recommended);

  // AI-Kl?rung hinzuf?gen, falls n?tig
  const finalReplyText = buildReplyTextWithAiClarify(
    baseReplyText,
    aiTrigger,
    recommended.length
  );

  return finalReplyText;
}

export function trimClarifyBlock(replyText: string | null | undefined): string {
  if (!replyText) return "";

  const marker = "Einige deiner Begriffe kann ich im Katalog nicht zuordnen";

  const idx = replyText.indexOf(marker);
  if (idx === -1) {
    // Kein Klarstellungs-Block -> Text unver?ndert zur?ckgeben
    return replyText.trim();
  }

  // Nur den Teil vor dem Marker behalten
  return replyText.slice(0, idx).trim();
}

