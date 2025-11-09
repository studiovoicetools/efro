"use client";

import { useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { MascotRive, useMascotElevenlabs } from "mascotbot-sdk-react";

export default function EmbedPage() {
  // 🎤 Verbindung zu ElevenLabs
  const conversation = useConversation();

  // 🧠 Avatar-Integration (LipSync & Gesten)
  useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  // 🗣 Avatar spricht automatisch nach dem Laden
  useEffect(() => {
    try {
      // Aktuelle SDK: Sprache über conversation.send()
      if (conversation && "send" in conversation) {
        // @ts-ignore – alte Typdefinitionen erlauben send nicht explizit
        conversation.send({
          text: "Hallo! Ich bin Efro – dein Verkaufsassistent.",
        });
      }
    } catch (err) {
      console.warn("Efro Speak Error:", err);
    }
  }, [conversation]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      <MascotRive
        src="/bear.riv"
        fit="contain"
        style={{ width: 320, height: 320 }}
      />
      <p style={{ marginTop: 20, opacity: 0.8 }}>
        🎙 Efro ist bereit – sprich mit mir!
      </p>
    </div>
  );
}
