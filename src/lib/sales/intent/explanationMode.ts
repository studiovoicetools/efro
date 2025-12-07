// src/lib/sales/intent/explanationMode.ts

import { normalize } from "@/lib/sales/modules/utils";

/**
 * Erkennt, ob der Nutzer eine Erklärung/Information anfordert (boolean).
 * 
 * Erweitert die bestehende detectExplanationMode-Logik um zusätzliche Patterns:
 * - "warum", "wieso", "weshalb"
 * - "unterschied zwischen", "difference between"
 * - "wie funktioniert", "wie benutze ich", etc.
 * 
 * @param normalizedQuery - Normalisierter Query-Text
 * @param words - Extrahierte Wörter aus dem Query (optional, für zukünftige Erweiterungen)
 * @returns true, wenn der Query erkennbar nach Erklärung/Info fragt
 */
export function detectExplanationModeBoolean(
  normalizedQuery: string,
  words?: string[]
): boolean {
  const query = normalizedQuery || "";
  if (!query.trim()) return false;

  const lowerQuery = query.toLowerCase();
  const normalized = normalize(query);

  // 1) Starke Erklärungs-Indikatoren am Anfang (bevorzugen Explanation)
  // CLUSTER 1 FIX: Erweitert um "Erklär mir bitte" und "Kannst du mir erklären"
  const strongExplanationStarters = [
    "warum",
    "wieso",
    "weshalb",
    "why",
    "erkläre",
    "erklären",
    "erklärt",
    "erklär mir",
    "erkläre mir",
    "erklären mir",
    "erklär mir bitte", // CLUSTER 1 FIX: S12
    "kannst du mir erklären", // CLUSTER 1 FIX: S12v2, S18v1
    "kannst du mir erkläre",
    "explain",
    "was ist der unterschied",
    "was ist der unterschied zwischen",
    "unterschied zwischen",
    "difference between",
    "wie funktioniert",
    "wie benutze ich",
    "wie verwende ich",
    "wie nutze ich",
    "wie wende ich",
    "wie ich benutze",
    "wie ich verwende",
    "wie ich nutze",
    "wie ich wende",
    "wie genau",
    "how does",
    "how do i",
    "how do you",
  ];

  // Prüfe, ob Query mit einem starken Erklärungs-Starter beginnt oder enthält
  let startsWithExplanation = strongExplanationStarters.some((starter) => {
    const normalizedStarter = normalize(starter);
    const lowerStarter = starter.toLowerCase();
    // Prüfe auf exakten Start oder enthalten (mit Leerzeichen davor/nachher)
    return (
      lowerQuery.startsWith(normalizedStarter) ||
      normalized.startsWith(normalizedStarter) ||
      lowerQuery.startsWith(lowerStarter) ||
      lowerQuery.includes(` ${normalizedStarter} `) ||
      normalized.includes(` ${normalizedStarter} `) ||
      lowerQuery.includes(` ${lowerStarter} `) ||
      // Auch ohne Leerzeichen am Anfang (z. B. "erklär mir bitte")
      lowerQuery.startsWith(normalizedStarter + " ") ||
      lowerQuery.startsWith(lowerStarter + " ")
    );
  });
  
  // Zusätzlich: Prüfe auf "erklär mir" / "erkläre mir" direkt (auch mit "bitte" dazwischen)
  // CLUSTER 1 FIX: Erkenne auch "Kannst du mir erklären" / "Kannst du mir erkläre"
  if (!startsWithExplanation) {
    const erklarMirPattern = /erklär(?:e|en)?\s+mir\s+(?:bitte\s+)?/i;
    const kannstDuMirErklarenPattern = /kannst\s+du\s+mir\s+erkl(?:ä|ae|a)r(?:e|en)?/i;
    if (erklarMirPattern.test(lowerQuery) || kannstDuMirErklarenPattern.test(lowerQuery)) {
      startsWithExplanation = true;
    }
  }

  if (startsWithExplanation) {
    // Wenn "warum"/"wieso"/"weshalb"/"explain" am Anfang steht, bevorzuge Explanation
    // auch wenn Kauf-Wörter vorhanden sind
    return true;
  }

  // 2) Erklärungs-Patterns im Query (deutsch + englisch)
  // CLUSTER 1 FIX: Erkenne auch "Kannst du mir erklären" (mir kommt VOR erklären)
  const explanationPatterns: RegExp[] = [
    /\b(warum|wieso|weshalb)\b/i,
    /\b(erkl(?:ä|ae|a)r(?:e|st|en)?)\s+(?:mir\s+)?(?:bitte\s+)?(?:mal\s+)?(?:genau\s+)?(?:wie|was|wieso|warum)?\b/i,
    /\berklär\s+mir\b/i,
    /\berkläre\s+mir\b/i,
    /\berklären\s+mir\b/i,
    /\bkannst\s+du\s+mir\s+erkl(?:ä|ae|a)r(?:e|en)?/i, // CLUSTER 1 FIX: "Kannst du mir erklären"
    /\b(unterschied|difference)\s+(zwischen|between)\b/i,
    /\bwie\s+(funktioniert|benutze|verwende|nutze|wende|genau)\b/i,
    /\bwie\s+ich\s+(benutze|verwende|nutze|wende|richtig)\b/i,
    /\bwie\s+ich\s+\w+\s+(benutze|verwende|nutze|wende|richtig)\b/i,
    /\bhow\s+(does|do\s+i|do\s+you)\b/i,
    /\bwas\s+ist\s+(der|die|das)\s+(unterschied|difference)\b/i,
    /\bwas\s+sind\s+(die|der|das)\s+(unterschiede|differences)\b/i,
    /\bwie\s+genau\s+(funktioniert|benutze|verwende)\b/i,
    /\banwendung\b/i,
    /\banwenden\b/i,
    /\bexplain\b/i,
  ];

  const hasExplanationPattern = explanationPatterns.some((pattern) =>
    pattern.test(lowerQuery)
  );

  if (hasExplanationPattern) {
    // 3) Prüfe, ob auch starke Kauf-Trigger vorhanden sind
    const purchaseTriggers = [
      "kaufen",
      "bestellen",
      "kauf",
      "bestellung",
      "zeig mir angebote",
      "günstig kaufen",
      "billig kaufen",
      "buy",
      "order",
      "purchase",
      "show me offers",
      "cheap",
    ];

    const hasPurchaseTrigger = purchaseTriggers.some((trigger) =>
      lowerQuery.includes(trigger)
    );

    // Wenn sowohl Explanation- als auch Purchase-Trigger vorhanden:
    // Bevorzuge Explanation, wenn "warum"/"wieso"/"weshalb"/"explain" vorkommt
    if (hasPurchaseTrigger) {
      const hasStrongExplanationWord =
        /\b(warum|wieso|weshalb|explain)\b/i.test(lowerQuery);
      return hasStrongExplanationWord;
    }

    // Sonst: Explanation-Mode aktivieren
    return true;
  }

  // 4) Keine Erklärungs-Indikatoren gefunden
  return false;
}

