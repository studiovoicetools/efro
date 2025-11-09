"use client";

import { useEffect } from "react";
import { MascotRive, useMascotElevenlabs } from "@mascotbot-sdk/react";

export default function EmbedPage() {
  // 🧩 absolut kompatibler Aufruf – keine Properties!
  const elevenlabs = useMascotElevenlabs({});

  useEffect(() => {
    try {
      elevenlabs?.speak?.("Hallo! Ich bin Efro – dein smarter Verkaufsassistent.");
    } catch (err) {
      console.error("Voice init error:", err);
    }
  }, [elevenlabs]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#0a0a0a",
        color: "#fff",
      }}
    >
      <MascotRive src="/bear.riv" fit="contain" style={{ width: 360, height: 360 }} />
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
