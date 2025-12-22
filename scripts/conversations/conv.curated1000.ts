// scripts/conversations/conv.curated1000.ts

export type ConvRole = "user" | "assistant";

export type ConvTurn = {
  role: ConvRole;
  text: string;
  content?: string; // Alias
};

export type ConversationCase = {
  id: string;
  note?: string;

  // häufige Varianten, damit der Runner es sicher findet:
  turns?: ConvTurn[];
  messages?: { role: ConvRole; content: string }[];
  conversation?: ConvTurn[];

  // optionale Checks (werden ignoriert, falls Runner das nicht nutzt)
  checks?: Array<{
    atUserTurnIndex: number; // 0-based: nur USER-turns zählen
    minProducts?: number;
    replyMustInclude?: string[];
    replyMustNotInclude?: string[];
  }>;
};

function mk(caseId: string, note: string, turns: ConvTurn[], checks?: ConversationCase["checks"]): ConversationCase {
  const messages = turns.map(t => ({ role: t.role, content: t.text }));
  return {
    id: caseId,
    note,
    turns,
    conversation: turns,
    messages,
    checks,
  };
}

export const conversations: ConversationCase[] = [
  // CONV 1: Budget + harte Constraints + Follow-ups (Kategorie darf nicht springen)
  mk(
    "conv-0001-budget-constraints-followup",
    "Hard constraints + follow-up tightening. Should keep context stable and not hallucinate.",
    [
      { role: "user", text: "Ich suche ein Geschenk: etwas für unter 35 €, aber bitte nicht rosa und nicht aus Leder. Was empfiehlst du?" },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Okay. Jetzt aber bitte nur etwas, das sofort verfügbar ist und für Kinder geeignet ist." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Und zeig mir bitte die 3 günstigsten Optionen aus deinen Empfehlungen." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },
    ],
    [
      { atUserTurnIndex: 0, minProducts: 1 },
      { atUserTurnIndex: 1, minProducts: 1 },
      { atUserTurnIndex: 2, minProducts: 1 },
    ]
  ),

  // CONV 2: Ambiguity + unknown term (AI-trigger) + Klarstellung
  mk(
    "conv-0002-unknown-term-clarify",
    "Unknown term should trigger aiTrigger/clarify instead of random category jump.",
    [
      { role: "user", text: "Hast du etwas wie einen 'KnarzStopper' für Türen? Muss leise sein, unter 15 €." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Ich meine so ein Teil gegen quietschende Türscharniere – also eher Pflege/Öl oder Spray." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Bitte ohne aggressiven Geruch und wenn möglich nicht brennbar." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },
    ],
    [
      { atUserTurnIndex: 0, minProducts: 0 }, // darf auch 0 sein, wichtig: nicht crashen / sauber reagieren
      { atUserTurnIndex: 1, minProducts: 1 },
    ]
  ),

  // CONV 3: Off-topic -> zurück zur Kaufabsicht (Robustness)
  mk(
    "conv-0003-offtopic-to-product",
    "Off-topic question should not crash; then pivot back to a real product request with constraints.",
    [
      { role: "user", text: "Kurze Frage: Was bedeutet eigentlich 'IPX7'?" },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Okay, danke. Jetzt suche ich eine kleine Bluetooth-Box fürs Bad, wasserdicht, unter 60 €. Nicht zu groß." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },

      { role: "user", text: "Und bitte nichts, was extrem basslastig ist – eher ausgewogen." },
      { role: "assistant", text: "(placeholder - runner will call SellerBrain)" },
    ],
    [
      { atUserTurnIndex: 1, minProducts: 1 },
      { atUserTurnIndex: 2, minProducts: 1 },
    ]
  ),
];

// Alias-Exports (falls dein Runner genau danach sucht)
export const curated1000 = conversations;
export default conversations;
