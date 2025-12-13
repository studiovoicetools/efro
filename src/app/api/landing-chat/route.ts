// src/app/api/landing-chat/route.ts
import { NextResponse } from "next/server";

type Msg = { role: "user" | "assistant"; content: string };
type Cta = { label: string; href: string };

function pickCtas(topic?: string): Cta[] {
  const base: Cta[] = [
    { label: "Demo-Shop testen (45 Produkte)", href: "/avatar-seller?shop=demo" },
    { label: "Installations-Flow ansehen", href: "/efro/onboarding" },
    { label: "Early Access ansehen", href: "/#early-access" },
  ];

  if (!topic) return base;

  if (topic === "demo") return [
    { label: "Demo-Shop starten", href: "/avatar-seller?shop=demo" },
    { label: "Zur Demo-Seite", href: "/demo" },
    { label: "Early Access", href: "/#early-access" },
  ];

  if (topic === "install") return [
    { label: "Onboarding / Installations-Flow", href: "/efro/onboarding" },
    { label: "Demo testen", href: "/avatar-seller?shop=demo" },
    { label: "Early Access", href: "/#early-access" },
  ];

  if (topic === "pricing") return [
    { label: "Early Access Pakete", href: "/#early-access" },
    { label: "Onboarding", href: "/efro/onboarding" },
    { label: "Demo testen", href: "/avatar-seller?shop=demo" },
  ];

  return base;
}

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function detectTopic(text: string): "install" | "demo" | "pricing" | "gdpr" | "catalog" | "general" {
  const t = normalize(text);

  if (/(preis|pricing|kosten|tarif|paket|starter|pro|enterprise|early)/.test(t)) return "pricing";
  if (/(install|installation|onboarding|shopify admin|embedded|oauth|billing)/.test(t)) return "install";
  if (/(demo|testen|test|45|produkte)/.test(t)) return "demo";
  if (/(dsgvo|start|einwilligung|consent|cookie|tracking|audio)/.test(t)) return "gdpr";
  if (/(katalog|scan|tags|titel|beschreibung|keywords|collection)/.test(t)) return "catalog";

  return "general";
}

function replyFor(topic: ReturnType<typeof detectTopic>, userText: string) {
  // Kurzer Profi-Seller Stil: fragt nach Kontext und führt Richtung Demo/Onboarding
  if (topic === "gdpr") {
    return `DSGVO-korrekt: Ich starte erst nach deinem Klick auf „Start“.
So vermeiden wir Auto-Audio/Auto-Interaktion ohne Einwilligung.

Wenn du willst: Sag mir kurz, was du verkaufst und welche typische Preisspanne du hast (z. B. 20–80€) – dann zeige ich dir, wie ich Kunden im Shop „abhole“.`;
  }

  if (topic === "install") {
    return `Installation (Shopify) läuft so:

1) App im Shopify Admin installieren (Embedded App)
2) EFRO scannt Produkte/Collections (Katalog-Basis)
3) Danach kann EFRO im Shop Kunden beraten + verkaufen
4) Optional: Optimierungsvorschläge (Titel/Tags/Beschreibung), damit Suche & Empfehlungen besser konvertieren

Magst du mir sagen, welche Produktkategorie du hast (z. B. Mode, Beauty, Zubehör) – und ob du eher „Budget“ oder „Premium“ verkaufst?`;
  }

  if (topic === "catalog") {
    return `Katalog-Scan & Optimierung:

- Ich nutze Produkte/Collections als Basis für Empfehlungen
- Danach zeige ich konkrete Vorschläge, z. B.:
  • bessere Titel (klarer, suchstärker)
  • Tags/Keywords (damit Kunden schneller finden)
  • Beschreibungen (mehr Nutzen, weniger Floskeln)

Wichtig: Je sauberer der Katalog, desto „profi-mäßiger“ verkaufe ich.

Welche 1–2 Produktkategorien sind bei dir am wichtigsten?`;
  }

  if (topic === "pricing") {
    return `Early Access ist günstiger, damit du EFRO früh testen kannst.
Später sind die Zielpreise höher (299€/699€/999€).

Wenn du mir sagst:
- wie viele Produkte du hast
- ob du Voice willst
- ob du Katalog-Optimierung brauchst
… empfehle ich dir das passende Paket.`;
  }

  if (topic === "demo") {
    return `Demo ist der schnellste Weg, mich live zu erleben:
Du bekommst einen Testkatalog (~45 Produkte) und kannst Fragen stellen wie:
- „unter 300€“
- „Premium“
- „Geschenk“
- „für Anfänger / Profi“

Ich antworte wie ein Verkäufer und zeige passende Produkte im Panel.

Willst du eher „günstig“ verkaufen oder „Premium“?`;
  }

  // general
  return `Alles klar. Ich bin EFRO – dein Profi-Seller als Avatar.

Damit ich dich sofort sauber berate:
1) Was verkaufst du? (Kategorie)
2) Welche Preisspanne ist typisch? (z. B. 20–80€)
3) Willst du eher „Budget“, „Bestseller“ oder „Premium“ pushen?`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string; history?: Msg[] };
    const message = (body?.message || "").trim();

    const topic = detectTopic(message);
    const reply = replyFor(topic, message);
    const ctas = pickCtas(topic === "general" ? undefined : topic);

    return NextResponse.json({ reply, ctas });
  } catch {
    return NextResponse.json(
      { reply: "Ups – ich konnte gerade nicht antworten. Versuch’s bitte nochmal.", ctas: pickCtas() },
      { status: 200 }
    );
  }
}
