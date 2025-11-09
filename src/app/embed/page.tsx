"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { Suspense, useState } from "react";
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

  const elevenlabs = useMascotElevenlabs({
    conversation: { status: "disconnected" },
  });

  const [riveInstance, setRiveInstance] = useState<any>(null);

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
        <MascotClient rive={riveInstance}>
          <MascotRive
            file="/mascot-v2.riv"          // ✅ aktuelles SDK-Prop
            fit={Fit.Contain}
            alignment={Alignment.Center}
            style={{ width: 400, height: 400 }}
            onRiveLoad={(rive: any) => {
              setRiveInstance(rive);
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
