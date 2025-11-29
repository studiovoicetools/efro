"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Alignment,
  Fit,
  MascotClient,
  MascotProvider,
  MascotRive,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";

interface ElevenLabsAvatarProps {
  dynamicVariables?: Record<string, string | number | boolean>;
}

function ElevenLabsAvatar({ dynamicVariables }: ElevenLabsAvatarProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);
  const urlRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTime = useRef<number | null>(null);

  // Natural LipSync Settings
  const [naturalLipSyncEnabled] = useState(true);
  const [lipSyncConfig] = useState({
    minVisemeInterval: 40,
    mergeWindow: 60,
    keyVisemePreference: 0.6,
    preserveSilence: true,
    similarityThreshold: 0.4,
    preserveCriticalVisemes: true,
    criticalVisemeMinDuration: 80,
  });

  // ELEVENLABS REALTIME
  const conversation = useConversation({
    micMuted: isMuted,
  });

  // ✔✔ WICHTIG: ORIGINAL useMascotElevenlabs
  const { isIntercepting } = useMascotElevenlabs({
    conversation,
    gesture: true,
    naturalLipSync: naturalLipSyncEnabled,
    naturalLipSyncConfig: lipSyncConfig,
  });

  // SIGNED URL
  const getSignedUrl = async () => {
    const res = await fetch("/api/get-signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dynamicVariables }),
    });

    if (!res.ok) throw new Error("Failed signed url");

    const data = await res.json();
    return data.signedUrl;
  };

  // Start
  const startConversation = useCallback(async () => {
    setIsConnecting(true);

    await navigator.mediaDevices.getUserMedia({ audio: true });

    const signedUrl = await getSignedUrl();

    await conversation.startSession({
      signedUrl,
      dynamicVariables,
    });

    setIsConnecting(false);
  }, [conversation, dynamicVariables]);

  // Stop
  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-10">
      <div className="text-white mb-4">
        LipSync: {isIntercepting ? "ON" : "OFF"}
      </div>

      {conversation.status === "connected" ? (
        <button
          onClick={stopConversation}
          className="bg-red-500 text-white px-10 py-5 rounded"
        >
          End Call
        </button>
      ) : (
        <button
          onClick={startConversation}
          className="bg-orange-500 text-white px-10 py-5 rounded"
        >
          {isConnecting ? "Connecting..." : "Start Voice Mode"}
        </button>
      )}
    </div>
  );
}

export default function WorkingAvatarPage() {
  const mascotUrl = "/bear.riv";
  const dynamicVariables = { name: "Charlie", language: "de" };

  return (
    <MascotProvider>
      <main className="w-full h-screen">
        <MascotClient
          src={mascotUrl}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{
            fit: Fit.Contain,
            alignment: Alignment.BottomCenter,
          }}
        >
          <MascotRive />
          <ElevenLabsAvatar dynamicVariables={dynamicVariables} />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
