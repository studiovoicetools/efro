"use client";

import { useEffect } from "react";
import { MascotRive, useMascotElevenlabs } from "@mascotbot-sdk/react";

export default function EmbedPage() {
  // 🧠 Hook-Aufruf mit aktuellem Schema (Provider + Options)
  const elevenlabs = useMascotElevenlabs({
    provider: "elevenlabs",
    options: {
      apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || "",
      voice: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL",
      model: "eleven_multilingual_v2",
      autoConnect: true,
    },
  });

  // 🎙 Avatar spricht automatisch nach dem Laden
  useEffect(() => {
    if (elevenlabs && typeof elevenlabs.speak === "function") {
      elevenlabs.speak("Hallo! Ich bin Efro – dein smarter Verkaufsassistent.");
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
            "Willkommen zurück! Bereit für das nächste Verkaufsgespräch?"
          )
        }
        style={{
          marginTop: 20,
          padding: "12px 24px",
          borderRadius: 8,
          background: "#00C4B3",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: 16,
        }}
      >
        Mit Efro sprechen
      </button>
    </div>
  );
}
