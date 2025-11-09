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

  useEffect(() => {
    console.log("👋 EmbedPage mounted");
    if (mode === "test") {
      console.log("🧪 Test mode active");
      // Avatar spricht Test-Text
      conversation.say?.("Hello, I’m Efro — your test assistant!");
    } else if (shop) {
      console.log(`🛍️ Shopify mode for ${shop}`);
      conversation.say?.(`Welcome back to ${shop}!`);
    } else {
      console.log("😶 Default mode (no parameters)");
    }
  }, [mode, shop, conversation]);

  return (
    <MascotProvider>
      <main className="w-full h-screen flex items-center justify-center bg-white">
        <MascotClient
          src="/mascot-v2.riv"
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{ fit: Fit.Contain, alignment: Alignment.Center }}
        >
          <MascotRive />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
