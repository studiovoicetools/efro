"use client";

export const prerender = false;   // 🚨 verhindert SSR-Fehler sicher

import { useCallback, useState } from "react";
import {
  Alignment,
  Fit,
  MascotClient,
  MascotProvider,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";
import { useConversation } from "@elevenlabs/react";

export default function AvatarEmbedPage() {
  const [status, setStatus] = useState<"idle" | "connecting" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);

  // ---- 1) ElevenLabs conversation ----
  const conversation = useConversation({
    onConnect() {
      setStatus("ready");
      console.log("🟢 ElevenLabs connected");
    },
    onDisconnect() {
      setStatus("idle");
    },
    onError(err) {
      console.error("ELEVEN ERROR:", err);
      setError(String(err));
      setStatus("idle");
    },
  });

  // ---- 2) Mascot lip sync ----
  useMascotElevenlabs({
    conversation,
    gesture: true,
    naturalLipSync: true,
  });

  // ---- 3) Start voice session ----
  const startConversation = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const res = await fetch("/api/get-signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Could not fetch signed URL");

      const { signedUrl } = await res.json();

      await conversation.startSession({ signedUrl });
    } catch (err: any) {
      console.error("Start error:", err);
      setError(err.message);
      setStatus("idle");
    }
  }, [conversation]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 300,
        height: 420,
        borderRadius: 16,
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
        background: "#fff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        zIndex: 999999,
      }}
    >
      <MascotProvider>
        {/* HEADER */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid #eee",
            fontWeight: 600,
          }}
        >
          EFRO Avatar
        </div>

        {/* MASCOT */}
        <div style={{ flex: 1, background: "#0f172a" }}>
          <MascotClient
            src="/mascot-v2.riv"
            artboard="Character"
            inputs={["is_speaking", "gesture"]}
            layout={{
              fit: Fit.Contain,
              alignment: Alignment.Center,
            }}
          />
        </div>

        {/* CONTROLS */}
        <div style={{ padding: 12 }}>
          {status === "idle" && (
            <button
              onClick={startConversation}
              style={{
                width: "100%",
                padding: 12,
                background: "#6366f1",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              Talk to EFRO
            </button>
          )}

          {status === "connecting" && (
            <div style={{ color: "#888" }}>Connecting…</div>
          )}

          {status === "ready" && (
            <div style={{ color: "#22c55e" }}>Listening…</div>
          )}

          {error && (
            <div style={{ marginTop: 8, color: "red", fontSize: 12 }}>
              {error}
            </div>
          )}
        </div>
      </MascotProvider>
    </div>
  );
}
