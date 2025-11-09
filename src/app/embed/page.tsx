"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  useMascotElevenlabs,
  Fit,
  Alignment,
  RiveState,
} from "mascotbot-sdk-react";

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  // ✅ Typkorrekt: Startstatus = "disconnected"
  const elevenlabs = useMascotElevenlabs({
    conversation: {
      status: "disconnected",
    },
  });

  // ✅ Rive-Instanz für MascotClient
  const riveRef = useRef<RiveState | null>(null);

  useEffect(() => {
    console.log("🧩 EmbedPage läuft im Modus:", mode);
    if (shop) console.log("🛍️ Verbundener Shop:", shop);
  }, [mode, shop]);

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
        <MascotClient rive={riveRef}>
          <MascotRive
            src="/mascot-v2.riv"
            fit={Fit.Contain}
            alignment={Alignment.Center}
            style={{ width: 400, height: 400 }}
            onRiveLoad={(rive) => {
              riveRef.current = rive;
              console.log("✅ Rive Avatar geladen");
            }}
          />
        </MascotClient>
      </MascotProvider>
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div>Loading Efro Avatar…</div>}>
      <EmbedInner />
    </Suspense>
  );
}
