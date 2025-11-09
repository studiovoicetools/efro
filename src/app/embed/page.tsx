"use client";

// ✅ Erzwingt dynamisches Rendering und verhindert statisches Exporten
export const dynamic = "force-dynamic";
export const revalidate = false;

import { useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const conversation = useConversation();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const speak = (text: string) =>
        (conversation as any)?.send?.({ text }).catch?.(() => {});
      speak("Hallo! Ich bin Efro – dein Verkaufsassistent.");
    } catch (err) {
      console.warn("Efro Speak Error:", err);
    }
  }, [mounted, conversation]);

  if (!mounted) return null;

  // ⚙️ LipSync/Gesten erst NACH Client-Mount aktivieren
  useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  return (
    <MascotProvider>
      <main
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "#0a0a0a",
          color: "#fff",
        }}
      >
        <MascotClient
          src="/mascot-v2.riv"
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{ fit: Fit.Contain, alignment: Alignment.Center }}
        >
          <MascotRive />
        </MascotClient>

        <p style={{ marginTop: 20, opacity: 0.8 }}>
          🎙 Efro ist bereit – teste mich!
        </p>
      </main>
    </MascotProvider>
  );
}
