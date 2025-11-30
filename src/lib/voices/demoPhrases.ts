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
    "Hey, schön, dass du da bist. Lass uns kurz reden, dann findest du schneller, was du suchst.",
    "Willkommen! Ich helfe dir, aus all den Produkten genau die richtigen rauszufischen.",
    "Hi! Keine Sorge, du musst nicht alles selbst durchklicken – ich sortiere dir das vor.",
    "Na, bereit für eine Abkürzung? Erzähl mir kurz, was du brauchst, ich kümmere mich um den Rest.",
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

