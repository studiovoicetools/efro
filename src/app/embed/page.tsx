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
  // 🎤 Voice conversation via ElevenLabs
  const conversation = useConversation();

  // 🧠 Voice-LipSync-Anbindung
  useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  // 🗣 Automatisch sprechen beim Laden
  useEffect(() => {
    try {
      if (conversation && "send" in conversation) {
        // @ts-ignore – Types erlauben send evtl. nicht explizit
        conversation.send({
          text: "Hallo! Ich bin Efro – dein Verkaufsassistent.",
        });
      }
    } catch (err) {
      console.warn("Efro Speak Error:", err);
    }
  }, [conversation]);

  // 🎨 Layout + Avatar
  return (
    <MascotProvider>
      <main
        style={{
          width: "100%",
          height: "100vh",
          background: "#0a0a0a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <MascotClient
          src="/mascot-v2.riv"
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{ fit: Fit.Contain, alignment: Alignment.Center }}
        >
          <MascotRive fit={Fit.Contain} />
        </MascotClient>

        <p style={{ marginTop: 20, opacity: 0.8 }}>
          🎙 Efro ist bereit – sag etwas oder teste mich!
        </p>
      </main>
    </MascotProvider>
  );
}
