"use client";

import { useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Alignment,
  Fit,
  MascotClient,
  MascotProvider,
  MascotRive,
  useMascotElevenlabs,
} from "mascotbot-sdk-react";

export default function EmbedPage() {
  // 🎤 ElevenLabs Konversation (gleiche Lib wie auf deiner Startseite)
  const conversation = useConversation();

  // 🔗 LipSync/Gesten an die laufende Konversation koppeln
  useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  // 🗣 Begrüßung beim Laden (send ist in manchen Typen nicht deklariert -> safe aufrufen)
  useEffect(() => {
    const speak = (text: string) =>
      (conversation as any)?.send?.({ text }).catch?.(() => {});
    speak("Hallo! Ich bin Efro – dein Verkaufsassistent.");
  }, [conversation]);

  // 🎨 Avatar – Rive wird über MascotClient geladen (nicht auf MascotRive!)
  return (
    <MascotProvider>
      <main
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#fff",
          flexDirection: "column",
        }}
      >
        <MascotClient
          src="/mascot-v2.riv"                         // <- dein Dateiname
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{ fit: Fit.Contain, alignment: Alignment.Center }}
        >
          {/* Wichtig: Keine Props auf MascotRive in deiner SDK-Version */}
          <MascotRive />
        </MascotClient>

        <p style={{ marginTop: 20, opacity: 0.8 }}>
          🎙 Efro ist bereit – sprich mit mir oder tippe eine Anfrage!
        </p>
      </main>
    </MascotProvider>
  );
}
