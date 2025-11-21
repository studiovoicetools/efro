"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Alignment,
  Fit,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";

import EFROChatWindow from "@/components/EFROChatWindow";

interface ElevenLabsAvatarProps {
  dynamicVariables?: Record<string, string | number | boolean>;
}

function ElevenLabsAvatar({ dynamicVariables }: ElevenLabsAvatarProps) {
  /* ===========================================================
      STATES
  ============================================================ */
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<
    { id: string; text: string; sender: "user" | "efro" }[]
  >([]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  const urlRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTime = useRef<number | null>(null);
  const [debugStatus, setDebugStatus] = useState("idle");

  /* LipSync */
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

  /* ===========================================================
      ELEVENLABS CONVERSATION
  ============================================================ */

  const conversation = useConversation({
    micMuted: isMuted,

    onConnect: () => {
      console.log("ElevenLabs Connected");
      setIsConnecting(false);
      setDebugStatus("connected");

      if (connectionStartTime.current) {
        console.log("Connected in:", Date.now() - connectionStartTime.current);
        connectionStartTime.current = null;
      }
    },

    onDisconnect: () => {
      console.log("ElevenLabs Disconnected");
      setDebugStatus("disconnected");
    },

    onError: (error: any) => {
      console.error("ElevenLabs Error:", error);
      setDebugStatus("error");
    },

    /* ===========================================================
        INCOMING MESSAGES (VOICE + EFRO)
    ============================================================ */
    onMessage: (msg: any) => {
      console.log("RAW-IN:", msg);

      const text =
        msg?.text ||
        msg?.message ||
        msg?.responseText ||
        msg?.output_text ||
        msg?.formattedText ||
        msg?.transcript ||
        null;

      if (!text) {
        console.log("Keine Text-Nachricht:", msg);
        return;
      }

      /* ===========================================================
         USER VOICE → orange
         Exakte Erkennung:
         ElevenLabs sendet immer:
            type: "input_transcription" oder "input_transcript"
      ============================================================ */
      if (
        msg.type === "input_transcript" ||
        msg.type === "input_transcription"
      ) {
        console.log("🎤 USER (Voice):", text);

        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text,
            sender: "user",
          },
        ]);

        return; // wichtig!
      }

      /* ===========================================================
         EFRO → grau
         (Assistant output immer type: "output_text" oder role: "assistant")
      ============================================================ */
      if (
        msg.role === "assistant" ||
        msg.type === "output_text" ||
        msg.type === "response_output" ||
        msg.output_audio ||
        msg.audio_output
      ) {
        console.log("🤖 EFRO:", text);

        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text,
            sender: "efro",
          },
        ]);

        return;
      }

      /* ===========================================================
         Fallback → wenn wir es nicht eindeutig zuordnen können
      ============================================================ */
      console.log("Fallback → EFRO:", text);

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text,
          sender: "efro",
        },
      ]);
    },
  });

  /* ===========================================================
      LIPSYNC HOOK
  ============================================================ */

  useMascotElevenlabs({
    conversation,
    gesture: true,
    naturalLipSync: naturalLipSyncEnabled,
    naturalLipSyncConfig: lipSyncConfig,
  });

  /* ===========================================================
      SIGNED URL
  ============================================================ */

  const getSignedUrl = async (): Promise<string> => {
    const response = await fetch(`/api/get-signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dynamicVariables: dynamicVariables || {} }),
    });

    const data = await response.json();
    return data.signedUrl;
  };

  const fetchAndCacheUrl = useCallback(async () => {
    try {
      const url = await getSignedUrl();
      setCachedUrl(url);
    } catch (error) {
      console.error("Failed signed URL:", error);
      setCachedUrl(null);
    }
  }, [dynamicVariables]);

  useEffect(() => {
    fetchAndCacheUrl();
    urlRefreshInterval.current = setInterval(fetchAndCacheUrl, 9 * 60 * 1000);

    return () => {
      if (urlRefreshInterval.current) clearInterval(urlRefreshInterval.current);
    };
  }, [fetchAndCacheUrl]);

  /* ===========================================================
      SESSION CONTROL
  ============================================================ */

  const startConversation = useCallback(async () => {
    try {
      setIsConnecting(true);
      setDebugStatus("connecting");
      connectionStartTime.current = Date.now();

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signedUrl = cachedUrl || (await getSignedUrl());

      await conversation.startSession({
        signedUrl,
        dynamicVariables,
      });

      setDebugStatus("connected");
    } catch (error) {
      console.error("Start error:", error);
      setIsConnecting(false);
      setDebugStatus("error");
    }
  }, [conversation, cachedUrl, dynamicVariables]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    setDebugStatus("disconnected");
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => !v);
  }, []);

  /* ===========================================================
      CHAT SEND
  ============================================================ */

  const handleChatSend = async (text: string) => {
    try {
      if (conversation.sendUserMessage) {
        await conversation.sendUserMessage(text);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text,
          sender: "user",
        },
      ]);
    } catch (err) {
      console.error("Chat send error:", err);
    }
  };

  /* ===========================================================
      RENDER
  ============================================================ */

  return (
    <>
      {/* DEBUG BOX */}
      <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-xl text-sm z-50">
        <div>Status: {debugStatus}</div>
        <div>Mic muted: {isMuted ? "yes" : "no"}</div>
        <div>Connecting: {isConnecting ? "yes" : "no"}</div>
      </div>

      {/* CHAT WINDOW */}
      {isChatOpen && (
        <EFROChatWindow
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSend={handleChatSend}
          messages={chatMessages}
        />
      )}

      {/* AVATAR + BUTTONS */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
        <div className="w-80 h-80 pointer-events-none">
          <MascotRive />
        </div>

        <div className="flex gap-3">
          {conversation.status === "connected" ? (
            <>
              <button
                onClick={stopConversation}
                className="h-12 px-5 bg-red-500 text-white rounded-lg shadow"
              >
                Mit EFRO auflegen
              </button>

              <button
                onClick={toggleMute}
                className="h-12 px-5 bg-white text-gray-800 border rounded-lg shadow"
              >
                {isMuted ? "Mikro an" : "Mikro aus"}
              </button>
            </>
          ) : (
            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="h-12 px-6 bg-orange-500 text-white rounded-lg shadow disabled:opacity-50"
            >
              {isConnecting ? "Verbinde…" : "Mit EFRO sprechen"}
            </button>
          )}

          <button
            onClick={() => setIsChatOpen(true)}
            className="h-12 px-5 bg-white text-gray-800 border rounded-lg shadow"
          >
            Chat öffnen
          </button>
        </div>
      </div>
    </>
  );
}

/* ===========================================================
   HOME WRAPPER (mit Shopify shop Param)
=========================================================== */

type HomeProps = {
  searchParams?: {
    shop?: string;
  };
};

export default function Home({ searchParams }: HomeProps) {
  const mascotUrl = "/retroBot.riv";

  // fuer Shopify: ?shop=domain kommt von der Theme Extension
  const shopDomain = searchParams?.shop ?? "local-dev";

  const dynamicVariables = {
    name: "EFRO",
    language: "de",
    userName: "Evren",
    shopDomain,
  };

  return (
    <MascotProvider>
      <main className="w-full h-screen bg-[#FFF8F0]">
        <MascotClient
          src={mascotUrl}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{
            fit: Fit.Contain,
            alignment: Alignment.BottomRight,
          }}
        >
          <ElevenLabsAvatar dynamicVariables={dynamicVariables} />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
