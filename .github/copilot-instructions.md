.github/copilot-instructions.md
EFRO Projekt – Copilot Master Instructions

(Deutsch, ohne Umlaute, Next.js + ElevenLabs + MascotBot + Shopify)

Diese Datei definiert, wie GitHub Copilot in diesem Projekt arbeiten soll.
Copilot soll keine eigenen Experimente machen, sondern strikt den hier beschriebenen Regeln folgen.

1. Architektur – Big Picture

EFRO ist ein Next.js App Router Projekt (src/app) mit drei Kernteilen:

Frontend (Avatar + Chat + UI)

Verwendet MascotProvider, MascotClient, MascotRive

Avatar rendert ohne Props:

<MascotRive />


Nur MascotClient darf die Rive-Datei referenzieren:

<MascotClient src="/bear.riv" ...>


Backend (Next.js API Routes)

Liegt in src/app/api/**

Wichtige Endpunkte:

/api/get-signed-url → erzeugt ElevenLabs signedURL fuer Realtime Voice

/api/shopify-products → holt Produktdaten aus Shopify

/api/explain-product → GPT-basierte Produkterklaerungen

Realtime Voice (ElevenLabs PRO)

Flow fuer Voice:

get-signed-url  -> conversation.startSession -> Voice, LipSync, Gestures


Kein WebRTC Code im Client notwendig, alles ueber ElevenLabs React SDK.

Shopify Einbindung

Avatar wird in theme.liquid injected

Holt Daten aus /products.json und EFRO Backend

2. Projekt-Konventionen

Keine Props in <MascotRive>
(src, riveUrl, stateMachines, fit, alignment sind verboten)

Rive-Dateien liegen immer in /public
Beispiel:

/public/bear.riv
/public/cat.riv
/public/robot.riv


Keine Nutzung von serverseitigen Hooks im Client Code

Keine .env Dateien committen (in .gitignore geregelt)

Nur use client Komponenten duerfen Conversational Logic enthalten

3. Kritische Workflows
Lokal starten:
npm install
npm run dev

Render deploy:
git add .
git commit -m "update"
git push

Wichtig:

Render nutzt Produktionsbuild, alle clientseitigen Fehler muessen lokal sichtbar sein.

4. Wichtigste API-Endpunkte
4.1 Signed URL (zentral fuer Avatar Voice)

Datei: src/app/api/get-signed-url/route.ts

Copilot muss folgende Struktur beibehalten:

import { NextResponse } from "next/server";
import { ElevenLabs } from "elevenlabs";

export async function POST(req: Request) {
  const client = new ElevenLabs({ apiKey: process.env.ELEVENLABS_API_KEY });
  const { dynamicVariables } = await req.json();

  const signedUrl = await client.realtime.sessions.create({
    agentId: process.env.ELEVENLABS_AGENT_ID,
    dynamicVariables,
  });

  return NextResponse.json({ signedUrl });
}


Nicht veraendern:

Endpunkt-Name

Return-Format

POST-Method

5. MascotBot Regeln
Richtig:
<MascotClient src="/bear.riv" artboard="Character" inputs={["is_speaking","gesture"]}>
  <MascotRive />
</MascotClient>

Falsch:
<MascotRive src="..." />
<MascotRive riveUrl="..." />
<MascotRive stateMachines={...} />

Natuerliches LipSync ist Pflicht:
useMascotElevenlabs({
  conversation,
  gesture: true,
  naturalLipSync: true,
});

6. ElevenLabs Regeln

Copilot MUSS immer folgendes Schema verwenden:

const conversation = useConversation({
  onConnect: () => {},
  onDisconnect: () => {},
  onError: (err) => {},
});


Voice starten:

const resp = await fetch("/api/get-signed-url", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ dynamicVariables }),
});

const { signedUrl } = await resp.json();

await conversation.startSession({ signedUrl });

7. Shopify Product Flow

Copilot soll folgendes Produktladenschema nutzen:

const res = await fetch("/api/shopify-products?category=hoodie");
const data = await res.json();
setProducts(data.products);


Produkt erklaeren:

await fetch("/api/explain-product", {
  method: "POST",
  body: JSON.stringify({ handle, question }),
});

8. Dateien, die Copilot NICHT anfassen darf

public/*.riv

.env.local

next.config.js

postcss.config.cjs

tailwind.config.js

Die komplette render.yaml, falls vorhanden

9. Ordnerstruktur, die Copilot respektieren muss
src/
  app/
    api/
      get-signed-url/
      shopify-products/
      explain-product/
    page.tsx
    embed/
public/
  bear.riv
  ...


Copilot darf keine neuen Root-Ordner erzeugen.

10. Copilot – Arbeitsregeln

Copilot soll:

keine neuen Architekturen einführen

niemals MascotRive Props hinzufuegen

niemals ElevenLabs WebRTC Code generieren

keine serverseitigen Funktionen in Client Components verwenden

API Endpunkte nicht ungefragt umbenennen

keine Env Variablen hartcodieren

Copilot darf:

neue UI-Komponenten erstellen

Produktfiltersystem erweitern

Avatar-UI erweitern

Chat-System verbessern

Shopify-APIs erweitern

Debug-Tools hinzufuegen

11. Beispiel: Avatar unten rechts (Standard EFRO Pattern)
<div className="fixed bottom-4 right-4 w-80 h-80 bg-white rounded-2xl shadow-xl overflow-hidden">
  <MascotClient src="/bear.riv" artboard="Character" inputs={["is_speaking","gesture"]}>
    <MascotRive />
  </MascotClient>
</div>