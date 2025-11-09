"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  useMascotElevenlabs,
  Fit,
  Alignment,
} from "mascotbot-sdk-react";
import { Rive } from "@rive-app/react-canvas";

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  const elevenlabs = useMascotElevenlabs({
    conversation: { status: "disconnected" },
  });

  // 🟢 Ref für Dummy-Canvas, damit TypeScript zufrieden ist
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [riveInstance, setRiveInstance] = useState<any>(null);

  useEffect(() => {
    async function loadMascot() {
      try {
        // Dummy-Canvas erzeugen (wird nicht gerendert, nur für TS-Parameter)
        const dummyCanvas = document.createElement("canvas");

        const rive = new Rive({
          src: "/mascot-v2.riv",
          canvas: dummyCanvas, // ✅ Pflichtparameter für Typ "RiveParameters"
          autoplay: true,
        });

        setRiveInstance(rive);
        console.log("✅ Mascot geladen:", rive);
      } catch (err) {
        console.error("❌ Fehler beim Laden von mascot-v2.riv:", err);
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
