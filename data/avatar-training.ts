// ERSTELLE DIESE DATEI: data/avatar-training.ts
export const avatarTrainingData = {
  // Produkt-Fragen und Antworten
  productQuestions: [
    {
      question: "Was ist das fÃ¼r ein Material?",
      response: "Das Produkt ist aus {material}. Sehr hochwertig und langlebig!"
    },
    {
      question: "Gibt es das in anderen Farben?",
      response: "Ja, verfÃ¼gbar in {farben}. Welche Farbe gefÃ¤llt dir am besten?"
    },
    {
      question: "Ist das wasserdicht?",
      response: "Ja, das Material ist {wasserfest}. Perfekt fÃ¼r Outdoor-AktivitÃ¤ten!"
    },
    {
      question: "Welche GrÃ¶ÃŸe empfehlst du?",
      response: "FÃ¼r {produkt} empfehle ich {grÃ¶ÃŸe}. Soll ich dir helfen die richtige GrÃ¶ÃŸe zu finden?"
    }
  ],
  
  // Checkout-Begleitung
  checkoutAssistance: [
    {
      step: "warenkorb",
      message: "Super Auswahl! Dein Warenkorb ist bereit. MÃ¶chtest du direkt zur Kasse?"
    },
    {
      step: "versand", 
      message: "Kostenloser Versand ab 50â‚¬ - fast geschafft! ğŸšš"
    },
    {
      step: "bezahlung",
      message: "Sicher bezahlen mit PayPal, Kreditkarte oder Klarna. Ich begleite dich durch den Prozess!"
    },
    {
      step: "bestellung_abgeschlossen",
      message: "ğŸ‰ Danke fÃ¼r deine Bestellung! Deine Produkte sind auf dem Weg."
    }
  ],
  
  // Cross-Selling Trigger
  crossSellingTriggers: [
    {
      when: "hoodie",
      suggest: ["cap", "tshirt", "beanie"],
      message: "ğŸ’¡ Dazu passt eine Cap oder T-Shirt perfekt! MÃ¶chtest du das auch sehen?"
    },
    {
      when: "snowboard", 
      suggest: ["bindungen", "schuhe", "helm", "brille"],
      message: "ğŸ‚ Vergiss nicht die passende AusrÃ¼stung! Ich zeige dir Snowboard-ZubehÃ¶r."
    },
    {
      when: "jacke",
      suggest: ["hoodie", "mÃ¼tze", "handschuhe"],
      message: "â„ï¸ Dazu passen Handschuhe und MÃ¼tze perfekt fÃ¼r kalte Tage!"
    },
    {
      when: "schuhe",
      suggest: ["socken", "einlegesohlen", "pflegemittel"],
      message: "ğŸ‘Ÿ FÃ¼r deine neuen Schuhe empfehle ich spezielle Socken und Pflegemittel."
    }
  ],

  // Verkaufstechniken
  salesTechniques: [
    {
      situation: "kunde_unsicher",
      response: "Das Produkt ist sehr beliebt! 94% unserer Kunden sind zufrieden. MÃ¶chtest du es probieren?"
    },
    {
      situation: "preis_bedenken", 
      response: "Die QualitÃ¤t rechtfertigt den Preis! Dazu gibt es 30 Tage RÃ¼ckgaberecht."
    },
    {
      situation: "farbe_auswahl",
      response: "{farbe} ist gerade total im Trend! Aber {andere_farbe} ist auch sehr schÃ¶n."
    }
  ]
};
