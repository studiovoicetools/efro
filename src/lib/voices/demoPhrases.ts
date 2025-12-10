/**
 * EFRO General Demo Phrases (German)
 *
 * Neutrale, avatar-unabhängige Sätze für Begrüßung,
 * Erklärung, Humor, Rückfragen und Call-to-Action.
 *
 * Können von jedem Avatar genutzt werden, um eine
 * erste Probeansprache oder Demo-Konversation zu starten.
 */

export type DemoPhraseCategory =
  | "intro"
  | "capability"
  | "humor"
  | "clarify"
  | "cta";

export const GENERAL_DEMO_PHRASES: Record<DemoPhraseCategory, string[]> = {
  intro: [
    "Hey, ich bin EFRO – dein digitaler Verkaufsberater hier im Shop. Erzähl mir kurz, was du suchst oder wofür du etwas brauchst, und ich helfe dir, die passenden Produkte zu finden.",
    "Hi, schön dass du da bist! 😊 Ich bin EFRO, dein Verkaufsberater. Schreib mir einfach, was dir wichtig ist – zum Beispiel Preis, Qualität, Marke oder ein Geschenk-Anlass – und ich stelle dir eine Auswahl zusammen, die wirklich zu dir passt.",
    "Hey, ich bin EFRO – dein digitaler Verkaufsberater hier im Shop. Erzähl mir kurz, was du suchst oder wofür du etwas brauchst, und ich helfe dir, die passenden Produkte zu finden.",
    "Hi, schön dass du da bist! 😊 Ich bin EFRO, dein Verkaufsberater. Schreib mir einfach, was dir wichtig ist – zum Beispiel Preis, Qualität, Marke oder ein Geschenk-Anlass – und ich stelle dir eine Auswahl zusammen, die wirklich zu dir passt.",
  ],
  capability: [
    "Sag mir einfach dein Budget und wofür du etwas brauchst – ich stelle dir eine passende Auswahl zusammen.",
    "Du kannst mir Begriffe wie \"Premium\", \"günstig\" oder eine Kategorie sagen – ich filtere den Shop danach.",
    "Wenn du willst, zeige ich dir nur Topseller, nur Premium-Produkte oder nur Produkte unter einem bestimmten Preis.",
    "Je genauer du mir sagst, was dir wichtig ist, desto besser werden meine Vorschläge.",
  ],
  humor: [
    "Je weniger du suchen musst, desto mehr Zeit bleibt dir für die wirklich wichtigen Dinge – Kaffee, Serien oder einfach nichts tun.",
    "Ich bin quasi dein persönlicher Produkt-Nerd – du redest, ich sortiere.",
    "Du kannst natürlich auch selbst alles durchklicken… aber warum, wenn ich das für dich übernehmen kann?",
    "Wenn du unsicher bist, sag einfach: \"Überrasch mich\" – und ich packe dir ein paar spannende Vorschläge auf den Tisch.",
  ],
  clarify: [
    "Klingt spannend – geht es dir mehr um Preis, Qualität oder Marke?",
    "Okay, das ist ein guter Start. Magst du mir noch dein Budget nennen, damit ich genauer filtern kann?",
    "Meinst du eher etwas für den Alltag oder etwas Besonderes für einen speziellen Anlass?",
    "Soll ich dir zuerst eine günstige Auswahl zeigen oder direkt die hochwertigen Premium-Optionen?",
  ],
  cta: [
    "Lass uns anfangen: Schreib mir einfach, was du suchst oder welches Budget du hast.",
    "Gib mir zwei Infos – Budget und grobe Richtung – und ich zeige dir gleich die ersten Produkte.",
    "Wenn du Ideen brauchst, frag mich einfach: \"Was empfiehlst du mir?\" – ich antworte wie ein Verkäufer, nicht wie ein Roboter.",
    "Du kannst direkt loslegen: Kategorie + Budget + eventuell \"Premium\" oder \"günstig\" – ich mach den Rest.",
  ],
};

/**
 * Holt eine zufällige Demo-Phrase aus einer bestimmten Kategorie
 */
export function getRandomDemoPhrase(category: DemoPhraseCategory): string {
  const list = GENERAL_DEMO_PHRASES[category];

  if (!list || list.length === 0) {
    return "Sag mir einfach kurz, was du suchst – ich helfe dir bei der Auswahl.";
  }

  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

/**
 * Holt alle Demo-Phrasen (z. B. zum Debugging oder Training)
 */
export function getAllDemoPhrases(): string[] {
  const all: string[] = [];

  (Object.keys(GENERAL_DEMO_PHRASES) as DemoPhraseCategory[]).forEach((category) => {
    all.push(...GENERAL_DEMO_PHRASES[category]);
  });

  return all;
}

