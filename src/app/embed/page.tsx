"use client";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect } from "react";
import { useConversation } from "@elevenlabs/react";
import { useMascotElevenlabs, MascotProvider, MascotClient, MascotRive, Fit, Alignment } from "mascotbot-sdk-react";

export default function EmbedPage() {
  // 🎤 Erst das ElevenLabs-Gesprächsobjekt anlegen
  const conversation = useConversation({
    onConnect: () => console.log("🎧 Connected to ElevenLabs."),
    onDisconnect: () => console.log("🔌 Disconnected."),
  });

  // 🤖 Dann Hook korrekt initialisieren (neues Schema!)
  const elevenlabs = useMascotElevenlabs({
    conversation,        // ← Pflichtfeld laut neuem SDK
    gesture: true,       // optional: aktiviert Lippenbewegung
  });

  useEffect(() => {
    console.log("✅ EmbedPage mounted – dynamic mode active");
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
