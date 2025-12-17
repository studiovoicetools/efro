import { DEFAULT_STORE_FACTS, type StoreFacts } from "./storeFacts";

export type KbAnswer = {
  source: "kb";
  topic:
    | "shipping"
    | "returns"
    | "warranty"
    | "payment"
    | "support"
    | "pickup"
    | "faq";
  answer: string;
  confidence: "high" | "medium";
};

function norm(s: string) {
  return (s || "").toLowerCase().trim();
}

function hasAny(text: string, terms: string[]) {
  const t = norm(text);
  return terms.some((x) => x && t.includes(x));
}

function joinParts(parts: Array<string | undefined | null>) {
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
}

export function kbRoute(
  userText: string,
  facts: StoreFacts = DEFAULT_STORE_FACTS
): KbAnswer | null {
  const t = norm(userText);
  if (!t) return null;

  // 1) FAQ first (nur wenn wirklich Treffer)
  if (facts.faq && facts.faq.length > 0) {
    const hit = facts.faq.find((f) =>
      hasAny(t, [
        norm(f.question),
        ...(f.tags ?? []).map(norm),
      ].filter(Boolean))
    );
    if (hit) {
      return {
        source: "kb",
        topic: "faq",
        answer: hit.answer,
        confidence: "high",
      };
    }
  }

  // Ab hier: NUR antworten, wenn Fakten vorhanden sind.
  const shippingHasFacts =
    !!facts.shipping?.deliveryTimeHint ||
    !!facts.shipping?.costsHint ||
    !!facts.shipping?.carriers?.length ||
    !!facts.shipping?.regions?.length ||
    facts.shipping?.freeShippingThresholdEur != null;

  const returnsHasFacts =
    facts.returns?.returnWindowDays != null ||
    !!facts.returns?.conditionsHint ||
    !!facts.returns?.processHint;

  const warrantyHasFacts = !!facts.warranty?.warrantyHint;

  const paymentHasFacts = !!facts.payment?.methods?.length;

  const supportHasFacts =
    !!facts.support?.email ||
    !!facts.support?.phone ||
    !!facts.support?.hoursHint ||
    !!facts.support?.responseTimeHint;

  const pickupHasFacts =
    facts.pickup?.available === true ||
    !!facts.pickup?.locationHint ||
    !!facts.pickup?.hoursHint;

  // 2) Policy Topics (Keyword Router) – nur wenn Facts existieren
  if (hasAny(t, ["versand", "liefer", "shipping", "delivery", "zustellung"])) {
    if (!shippingHasFacts) return null;

    const answer = joinParts([
      facts.shipping?.deliveryTimeHint,
      facts.shipping?.costsHint,
      facts.shipping?.carriers?.length ? `Carrier: ${facts.shipping.carriers.join(", ")}.` : null,
      facts.shipping?.regions?.length ? `Regionen: ${facts.shipping.regions.join(", ")}.` : null,
      facts.shipping?.freeShippingThresholdEur != null
        ? `Gratis Versand ab ${facts.shipping.freeShippingThresholdEur} € (sofern zutreffend).`
        : null,
    ]);

    return {
      source: "kb",
      topic: "shipping",
      answer,
      confidence: "medium",
    };
  }

  if (hasAny(t, ["retour", "rückgab", "return", "umtausch"])) {
    if (!returnsHasFacts) return null;

    const answer = joinParts([
      facts.returns?.returnWindowDays != null ? `Rückgabefrist: ${facts.returns.returnWindowDays} Tage.` : null,
      facts.returns?.conditionsHint,
      facts.returns?.processHint,
    ]);

    return {
      source: "kb",
      topic: "returns",
      answer,
      confidence: "medium",
    };
  }

  if (hasAny(t, ["garantie", "gewähr", "warranty"])) {
    if (!warrantyHasFacts) return null;

    return {
      source: "kb",
      topic: "warranty",
      answer: facts.warranty?.warrantyHint ?? "",
      confidence: "medium",
    };
  }

  if (hasAny(t, ["zahlung", "paypal", "klarna", "kredit", "payment"])) {
    if (!paymentHasFacts) return null;

    return {
      source: "kb",
      topic: "payment",
      answer: `Mögliche Zahlungsarten: ${facts.payment?.methods?.join(", ") ?? ""}.`,
      confidence: "medium",
    };
  }

  if (hasAny(t, ["support", "kontakt", "email", "telefon", "erreichbar", "öffnungs"])) {
    if (!supportHasFacts) return null;

    const answer = joinParts([
      facts.support?.hoursHint,
      facts.support?.responseTimeHint,
      facts.support?.email ? `E-Mail: ${facts.support.email}.` : null,
      facts.support?.phone ? `Telefon: ${facts.support.phone}.` : null,
    ]);

    return {
      source: "kb",
      topic: "support",
      answer,
      confidence: "medium",
    };
  }

  if (hasAny(t, ["abholung", "pickup", "vor ort", "store"])) {
    if (!pickupHasFacts) return null;

    const answer =
      facts.pickup?.available === false
        ? "Abholung ist aktuell nicht als verfügbar hinterlegt."
        : joinParts([facts.pickup?.locationHint, facts.pickup?.hoursHint]);

    return {
      source: "kb",
      topic: "pickup",
      answer,
      confidence: "medium",
    };
  }

  return null;
}
