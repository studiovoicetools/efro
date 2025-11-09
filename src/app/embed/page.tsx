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

  // 1️⃣ ElevenLabs Conversation-Hook
  const conversation = useConversation({
    onConnect: () => console.log("🎧 ElevenLabs connected"),
  });

  // 2️⃣ Mascotbot-Integration (conversation ist Pflicht)
  const elevenlabs = useMascotElevenlabs({
    conversation,
  });

  useEffect(() => {
    console.log("👋 EmbedPage mounted");

    if (!conversation.startSession) {
      console.warn("⚠️ Conversation API not ready");
      return;
    }

    const startEfro = async (text: string) => {
      try {
        const session = await conversation.startSession({
          agentId: "default",
          connectionType: "websocket",
        });
        // Sobald Session aktiv ist, Text senden
        if (session && "send" in session) {
          session.send({ text });
        }
      } catch (err) {
        console.error("❌ Failed to start session:", err);
      }
    };

    if (mode === "test") {
      console.log("🧪 Test mode active");
      startEfro("Hello, I’m Efro — your test assistant!");
    } else if (shop) {
      console.log(`🛍️ Shopify mode for ${shop}`);
      startEfro(`Welcome back to ${shop}!`);
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
