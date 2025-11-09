"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  useMascotElevenlabs,
  Fit,
  Alignment,
  loadRiveFile, // ✅ offizielle Utility-Funktion des SDK
} from "mascotbot-sdk-react";

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  const elevenlabs = useMascotElevenlabs({
    conversation: { status: "disconnected" },
  });

  const [riveInstance, setRiveInstance] = useState<any>(null);

  useEffect(() => {
    // ✅ Mascot Rive-Datei korrekt laden
    async function loadMascot() {
      try {
        const rive = await loadRiveFile("/mascot-v2.riv");
        setRiveInstance(rive);
        console.log("✅ Mascot geladen:", rive);
      } catch (err) {
        console.error("❌ Fehler beim Laden des Mascot-Rive-Files:", err);
      }
    }
    loadMascot();
  }, []);

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
        {riveInstance ? (
          <MascotClient rive={riveInstance}>
            <MascotRive
              fit={Fit.Contain}
              alignment={Alignment.Center}
              style={{ width: 400, height: 400 }}
            />
          </MascotClient>
        ) : (
          <div>Loading Efro Avatar …</div>
        )}
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
