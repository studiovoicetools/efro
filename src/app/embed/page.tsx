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
} from "mascotbot-sdk-react";
import { Rive, Fit, Alignment, Layout } from "@rive-app/react-canvas";

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  const elevenlabs = useMascotElevenlabs({
    conversation: { status: "disconnected" },
  });

  const [riveInstance, setRiveInstance] = useState<any>(null);

  useEffect(() => {
    try {
      const dummyCanvas = document.createElement("canvas");

      // ✅ Rive korrekt mit separatem Layout-Import
      const rive = new Rive({
        src: "/mascot-v2.riv",
        canvas: dummyCanvas,
        autoplay: true,
        layout: new Layout({
          fit: Fit.Contain,
          alignment: Alignment.Center,
        }),
      });

      setRiveInstance(rive);
      console.log("✅ Mascot geladen:", rive);
    } catch (err) {
      console.error("❌ Fehler beim Laden von mascot-v2.riv:", err);
    }
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
            <div style={{ width: 400, height: 400 }}>
              <MascotRive />
            </div>
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
