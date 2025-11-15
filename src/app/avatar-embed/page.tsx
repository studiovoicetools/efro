"use client";

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

  // ---- 1) ElevenLabs Realtime Conversation ----
  const conversation = useConversation({
    onConnect() {
      setStatus("ready");
      console.log("🎉 ElevenLabs connected");
    },
    onDisconnect() {
      setStatus("idle");
    },
    onError(err) {
      console.error("ElevenLabs error", err);
      setError(String(err));
      setStatus("idle");
    },
  });

  // ---- 2) MascotBot LipSync Integration ----
  useMascotElevenlabs({
    conversation,
    gesture: true,
    naturalLipSync: true,
  });

  // ---- 3) Start Realtime ----
  const startConversation = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      // Mikrofon-Berechtigung
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Signierte URL vom Backend holen
      const res = await fetch("/api/get-signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error("Could not fetch signed URL");

      const { signedUrl } = await res.json();

      // Startet die Echtzeit-Sprachsession
      await conversation.startSession({ signedUrl });
    } catch (err: any) {
      console.error("Start error", err);
      setError(err.message);
      setStatus("idle");
    }
  }, [conversation]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: "transparent",
          overflow: "hidden",
        }}
      >
        <MascotProvider>
          <div
            style={{
              position: "fixed",
              bottom: 16,
              right: 16,
              width: 300,
              height: 420,
              borderRadius: 16,
              background: "#ffffff",
              boxShadow: "0 12px 30px rgba(0,0,0,0.25)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid #eee",
                fontWeight: 600,
              }}
            >
              EFRO Avatar (Beta)
            </div>

            {/* Avatar Rendering */}
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

            {/* Controls */}
            <div style={{ padding: 12 }}>
              {status === "idle" && (
                <button
                  onClick={startConversation}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    background: "#6366f1",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  Talk to EFRO
                </button>
              )}

              {status === "connecting" && (
                <div style={{ color: "#555" }}>Connecting…</div>
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
          </div>
        </MascotProvider>
      </body>
    </html>
  );
}
