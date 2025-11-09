"use client";

export const revalidate = 0;
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

import { useEffect } from "react";
import { useMascotElevenlabs } from "mascotbot-sdk-react";
import { MascotProvider, MascotClient, MascotRive, Fit, Alignment } from "mascotbot-sdk-react";

export default function EmbedPage() {
  const elevenlabs = useMascotElevenlabs({}); // ✅ Fix: Übergabe leeres Objekt

  useEffect(() => {
    console.log("Embed mounted – dynamic mode active");
  }, []);

  return (
    <MascotProvider>
      <main className="w-full h-screen flex items-center justify-center">
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
