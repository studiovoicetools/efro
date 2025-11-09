"use client";

import { useEffect } from "react";
import { MascotRive, useMascotElevenlabs } from "@mascotbot-sdk/react";

export default function EmbedPage() {
  // ✅ Hook jetzt ohne Parameter aufrufen
  const elevenlabs = useMascotElevenlabs();

  // 🎙 Avatar spricht automatisch beim Laden
  useEffect(() => {
    if (elevenlabs && typeof elevenlabs.speak === "function") {
      elevenlabs.speak("Hallo! Ich bin Efro – dein smarter Verkaufsassistent.", {
        voice: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
        model: "eleven_multilingual_v2",
        autoConnect: true,
      });
    }
  }, [elevenlabs]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#0a0a0a",
        flexDirection: "column",
        color: "#fff",
        textAlign: "center",
      }}
    >
      <MascotRive
        src="/bear.riv"
        fit="contain"
        style={{ width: 380, height: 380 }}
      />

      <button
        onClick={() =>
          elevenlabs?.speak?.(
            "Willkommen zurück! Bereit für das nächste Verkaufsgespräch?",
            {
              voice: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
              model: "eleven_multilingual_v2",
              autoConnect: true,
            }
          )
        }
        style={{
          marginTop: "20px",
          padding: "12px 24px",
          borderRadius: "8px",
          background: "#00C4B3",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        Mit Efro sprechen
      </button>
    </div>
  );
}
