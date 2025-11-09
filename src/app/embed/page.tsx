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

  // 🧠 ElevenLabs Conversation Hook
  const conversation = useConversation({
    onConnect: () => console.log("🎧 ElevenLabs connected"),
  });

  // 🐼 MascotBot Integration mit Conversation
  const elevenlabs = useMascotElevenlabs({ conversation });

  useEffect(() => {
    console.log("👋 EmbedPage mounted");

    if (!conversation.startSession) {
      console.warn("⚠️ Conversation API not ready");
      return;
    }

    const startEfro = async (text: string) => {
      try {
        // Diese SDK-Version gibt KEIN Session-Objekt zurück
        await conversation.startSession({
          agentId: "default",
          connectionType: "websocket",
        });
        // Text direkt über conversation senden (nicht über session)
        if ("send" in conversation) {
          // @ts-ignore: send ist dynamisch vorhanden
          conversation.send({ text });
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
