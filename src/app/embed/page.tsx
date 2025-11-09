"use client";

export const dynamic = "force-dynamic";
export const revalidate = false;

import { Suspense, useEffect } from "react";
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

  const elevenlabs = useMascotElevenlabs({ conversation });

  useEffect(() => {
    console.log("👋 EmbedPage mounted");

    const startEfro = async (text: string) => {
      try {
        await conversation.startSession({
          agentId: "default",
          connectionType: "websocket",
        });
        // Text an Avatar schicken
        // @ts-ignore
        conversation.send?.({ text });
      } catch (err) {
        console.error("❌ Failed to start session:", err);
      }
    };

    if (mode === "test") startEfro("Hello, I’m Efro — your test assistant!");
    else if (shop) startEfro(`Welcome back to ${shop}!`);
  }, [mode, shop, conversation]);

  return (
    <Suspense fallback={<div>Loading Efro...</div>}>
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
    </Suspense>
  );
}
