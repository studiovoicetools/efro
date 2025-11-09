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
    onConnect: () => console.log("🎧 Connected to ElevenLabs"),
    onDisconnect: () => console.log("🔌 Disconnected"),
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
          {/* ⬇️ useMascotElevenlabs wird jetzt INNERHALB von MascotClient verwendet */}
          <MascotContent conversation={conversation} />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}

function MascotContent({ conversation }: { conversation: any }) {
  useMascotElevenlabs({ conversation, gesture: true });
  return <MascotRive />;
}
