"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  useMascotElevenlabs,
  Fit,
  Alignment,
} from "mascotbot-sdk-react";

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  // 🎧 ElevenLabs Integration (bleibt unverändert)
  const elevenlabs = useMascotElevenlabs({
    conversation: { status: "disconnected" },
  });

  // 🧩 Ref für die Rive-Instanz
  const riveRef = useRef(null);

  console.log("🧩 Embed läuft:", mode, "Shop:", shop || "–");

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f9f9f9",
      }}
    >
      <MascotProvider>
        {/* ✅ rive={riveRef} ist Pflichtprop */}
        <MascotClient rive={riveRef}>
          <MascotRive
            src="/mascot-v2.riv"
            fit={Fit.Contain}
            alignment={Alignment.Center}
            style={{ width: 400, height: 400 }}
            onRiveLoad={(rive: any) => {
              // Referenz speichern, wenn geladen
              riveRef.current = rive;
              console.log("✅ Rive geladen:", rive);
            }}
          />
        </MascotClient>
      </MascotProvider>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div>Loading Efro Avatar …</div>}>
      <EmbedInner />
    </Suspense>
  );
}
