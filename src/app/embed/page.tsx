"use client";

import { useEffect } from "react";
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
  const conversation = useConversation({
    onConnect: () => console.log("🎧 Connected to ElevenLabs."),
    onDisconnect: () => console.log("🔌 Disconnected."),
  });

  const elevenlabs = useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  useEffect(() => {
    console.log("✅ EmbedPage mounted – client mode only (no prerender)");
  }, []);

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
