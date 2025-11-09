"use client";

import { useConversation } from "@elevenlabs/react";
import { useEffect } from "react";
import { MascotRive, useMascotElevenlabs } from "mascotbot-sdk-react";

export default function EmbedPage() {
  // 🎤 Verbindung zu ElevenLabs (Pflichtobjekt)
  const conversation = useConversation();

  // 🔗 Verbindung zur Mascot-SDK herstellen
  const { isIntercepting } = useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  useEffect(() => {
    if (conversation && typeof conversation.send === "function") {
      conversation.send({
        text: "Hallo! Ich bin Efro – dein Verkaufsassistent.",
      });
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
        color: "white",
      }}
    >
      <MascotRive src="/bear.riv" fit="contain" style={{ width: 300, height: 300 }} />
      <p style={{ marginTop: 16, opacity: 0.8 }}>
        {isIntercepting ? "🎙 Stimme aktiv" : "🕔 Verbinde ..."}
      </p>
    </div>
  );
}
