"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useConversation } from "@elevenlabs/react";
import {
  useMascotElevenlabs,
  MascotProvider,
  MascotClient,
  MascotRive,
  Fit,
  Alignment,
} from "mascotbot-sdk-react";

export default function EmbedPage() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const shop = searchParams.get("shop");

  const conversation = useConversation({
    onConnect: () => console.log("🎧 ElevenLabs connected"),
  });

  // Verbindung zu ElevenLabs Avatar vorbereiten (kein autoConnect-Flag)
  const elevenlabs = useMascotElevenlabs({});

  useEffect(() => {
    console.log("👋 EmbedPage mounted");

    if (!conversation.startSession) {
      console.warn("⚠️ ElevenLabs conversation not ready yet.");
      return;
    }

    if (mode === "test") {
      console.log("🧪 Test mode active");
      conversation.startSession({
        agentId: "default", // Dummy-ID (später dein echter Agent)
        connectionType: "websocket",
        conversationConfig: {
          initialText: "Hello, I’m Efro — your test assistant!",
        },
      });
    } else if (shop) {
      console.log(`🛍️ Shopify mode for ${shop}`);
      conversation.startSession({
        agentId: "default",
        connectionType: "websocket",
        conversationConfig: {
          initialText: `Welcome back to ${shop}!`,
        },
      });
    } else {
      console.log("😶 Default mode (no parameters)");
    }
  }, [mode, shop, conversation]);

  return (
    <MascotProvider>
      <main className="w-full h-screen flex items-center justify-center bg-white">
        <MascotClient
          src="/mascot-v2.riv"
          layout={{ fit: Fit.Contain, alignment: Alignment.Center }}
          inputs={["is_speaking", "gesture"]}
        >
          <MascotRive />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
