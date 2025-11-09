"use client";

import { useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { MascotRive, useMascotElevenlabs } from "mascotbot-sdk-react";

export default function EmbedPage() {
  // 🎙 Conversation-Objekt vom ElevenLabs-Hook
  const conversation = useConversation();

  // 🧠 Mascot-Integration mit Voice-Steuerung
  const elevenlabs = useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  // 🗣 Avatar soll beim Laden sprechen
  useEffect(() => {
    try {
      elevenlabs?.speak?.("Hallo! Ich bin Efro – dein Verkaufsassistent.");
    } catch (err) {
      console.warn("Efro Speak Error:", err);
    }
  }, [elevenlabs]);

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
      <button
        onClick={() =>
          elevenlabs?.speak?.(
            "Willkommen zurück! Bereit für dein nächstes Verkaufsgespräch?"
          )
        }
        style={{
          marginTop: 24,
          padding: "12px 28px",
          background: "#00C4B3",
          color: "#fff",
          border: "none",
          borderRadius: 12,
          fontWeight: "bold",
          cursor: "pointer",
          fontSize: 16,
        }}
      >
        Mit Efro sprechen
      </button>
    </div>
  );
}
