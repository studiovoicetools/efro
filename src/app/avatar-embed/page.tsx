// src/app/avatar-embed/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alignment,
  Fit,
  MascotProvider,
  MascotRive,
} from "@mascotbot-sdk/react";

function AvatarEmbedPage() {
  const [status, setStatus] = useState<"idle" | "connecting" | "ready" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    console.log("EFRO Avatar iframe loaded");
    return () => {
      // cleanup
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, []);

  async function startConversation() {
    try {
      setError(null);
      setStatus("connecting");

      // 1) PeerConnection anlegen
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 2) Audio Output
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = (event) => {
        if (event.streams[0]) {
          audio.srcObject = event.streams[0];
        }
      };

      // 3) Mikrofon holen
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4) Offer erzeugen
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 5) Offer an dein Backend schicken
      const res = await fetch("/api/convai/offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sdp: offer.sdp }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Backend error: ${res.status} - ${txt}`);
      }

      const answerSDP = await res.text();
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: answerSDP,
      };

      await pc.setRemoteDescription(answer);

      console.log("EFRO Avatar connected via ElevenLabs Convai");
      setStatus("ready");
    } catch (err: any) {
      console.error("startConversation error", err);
      setError(err?.message || "Unknown error");
      setStatus("error");
    }
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          background: "transparent",
        }}
      >
        <MascotProvider>
          <div
            style={{
              position: "fixed",
              bottom: 16,
              right: 16,
              width: 320,
              maxWidth: "90vw",
              height: 420,
              maxHeight: "80vh",
              borderRadius: 16,
              boxShadow: "0 16px 40px rgba(0,0,0,0.25)",
              background: "white",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #eee",
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              EFRO Avatar
              <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 4 }}>
                (Preview)
              </span>
            </div>

            {/* Avatar Area */}
            <div
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #0f172a, #1e293b)",
                position: "relative",
              }}
            >
              <MascotRive
  riveUrl="/mascot-v2.riv"
  fit={Fit.CONTAIN}
  alignment={Alignment.CENTER}
  stateMachines={["State Machine 1"]}
/>
            </div>

            {/* Controls */}
            <div
              style={{
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 13,
              }}
            >
              <button
                onClick={startConversation}
                disabled={status === "connecting" || status === "ready"}
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "none",
                  cursor:
                    status === "connecting" || status === "ready"
                      ? "default"
                      : "pointer",
                  background:
                    status === "ready"
                      ? "#16a34a"
                      : "linear-gradient(135deg, #6366f1, #22d3ee)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {status === "idle" && "Talk with EFRO"}
                {status === "connecting" && "Connecting..."}
                {status === "ready" && "Listening..."}
                {status === "error" && "Retry"}
              </button>

              <div style={{ color: "#6b7280" }}>
                {status === "idle" && "Click to allow microphone and start."}
                {status === "connecting" &&
                  "Setting up secure audio connection..."}
                {status === "ready" && "You can speak now."}
                {status === "error" &&
                  "There was a problem. Please check mic permission and try again."}
              </div>

              <div style={{ color: "#9ca3af", fontSize: 11 }}>
                Voice handled by ElevenLabs. Audio only starts after your
                explicit click (DSGVO friendly).
              </div>

              {error && (
                <div
                  style={{
                    marginTop: 4,
                    color: "#b91c1c",
                    fontSize: 11,
                    whiteSpace: "pre-wrap",
                  }}
                >
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

export default AvatarEmbedPage;
