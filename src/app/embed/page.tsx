// src/app/embed/page.tsx
"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import React, { useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  useMascotElevenlabs,
  Fit,
  Alignment,
} from "mascotbot-sdk-react";

// 💡 Diese Komponente wird clientseitig ausgeführt, nicht prerendered!
function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop") || null;

  // Verbindung zu ElevenLabs Avatar herstellen
  const elevenlabs = useMascotElevenlabs({
    conversation: {
      start: true,
    },
  });

  useEffect(() => {
    console.log("🧩 Embed mounted - dynamic mode active");
    if (mode === "test") {
      console.log("🧪 Test mode active – no static prerender");
    }
  }, [mode]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f7f7f7",
      }}
    >
      <MascotProvider>
        <MascotClient>
          <MascotRive
            src="/mascot-v2.riv"
            fit={Fit.Contain}
            alignment={Alignment.Center}
            style={{ width: 400, height: 400 }}
          />
        </MascotClient>
      </MascotProvider>
    </div>
  );
}

// ✅ Suspense schützt gegen "missing suspense with CSR bailout"
export default function EmbedPage() {
  return (
    <Suspense fallback={<div>Loading Avatar...</div>}>
      <EmbedInner />
    </Suspense>
  );
}
