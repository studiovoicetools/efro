"use client";

import { useState, useCallback } from "react";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Alignment,
  Fit,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";
import { useConversation } from "@elevenlabs/react";

// Typbremse: wir kapseln Mascot-Komponenten in any-Wrapper,
// damit sich aendernde Props/Typen keinen Build mehr sprengen.
const MascotClientAny: any = MascotClient;
const MascotRiveAny: any = MascotRive;

export default function WorkingAvatar() {
  const [status, setStatus] = useState("idle");

  // ELEVENLABS: realtime conversation
  // Options als any casten, damit neue Callbacks nicht zum TS-Fehler werden
  const conversation = useConversation({
    onAudioStart: () => {
      setStatus("speaking");
    },
    onAudioEnd: () => {
      setStatus("idle");
    },
  } as any);

  // Zentraler Any-Wrapper fuer alle spaeteren Aufrufe
  const conversationAny = conversation as any;

  // WICHTIG: LipSync direkt mit WS verbinden
  // Options als any, damit 'ws' im Typ nicht stoert
  useMascotElevenlabs({
    ws: conversationAny.ws,
    isIntercepting: true,
  } as any);

  // Session starten
  const startTalking = useCallback(async () => {
    setStatus("lade signed url...");

    const res = await fetch("/api/get-signed-url");
    const json = await res.json();
    if (!json.signedUrl) {
      setStatus("keine signedUrl");
      return;
    }

    // Session-Config als any: ertraegt Zusatzfelder wie enableTalkingAnimations
    await conversationAny.startSession({
      signedUrl: json.signedUrl,
      enableTalkingAnimations: true,
      dynamicVariables: {
        language: "de",
        userName: "Tester",
      },
    } as any);

    setStatus("spricht...");

    await conversationAny.sendUserInput(
      "Hallo, dies ist der Test des funktionierenden Mascotbot Lip Sync Avatars."
    );
  }, [conversationAny]);

  return (
    <MascotProvider>
      <MascotClientAny>
        <div
          style={{
            width: "100%",
            height: "100vh",
            background: "#111",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            gap: "20px",
            position: "relative",
          }}
        >
          {/* Debug oben links */}
          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              background: "rgba(255,255,255,0.1)",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            <div>Status: {status}</div>
            <div>LipSync: {conversationAny.ws ? "yes" : "no"}</div>
          </div>

          {/* Avatar */}
          <div style={{ width: 350, height: 350 }}>
            <MascotRiveAny
              src="/bear.riv"
              artboard="main"
              stateMachine="State Machine 1"
              alignment={Alignment.Center}
              fit={Fit.Contain}
            />
          </div>

          <button
            onClick={startTalking}
            style={{
              padding: "14px 22px",
              fontSize: "18px",
              background: "#4A9EFF",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              color: "white",
            }}
          >
            Start talking
          </button>
        </div>
      </MascotClientAny>
    </MascotProvider>
  );
}
