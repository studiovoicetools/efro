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

function EmbedInner() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") || "live";
  const shop = searchParams.get("shop");

  // ✅ Typkorrektes Conversation-Objekt mit gültigem Status
  const elevenlabs = useMascotElevenlabs({
    conversation: {
      status: "idle", // gültiger Startzustand
    },
  });

  useEffect(() => {
    console.log("[Render: dynamic OK] – /embed läuft in force-dynamic Mode");
    if (mode === "test") {
      console.log("🧪 Test mode aktiv – kein statisches Prerendering");
    } else if (shop) {
      console.log(`🛍️ Shopify mode für ${shop}`);
    }
  }, [mode, shop]);

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

export default function EmbedPage() {
  return (
    <Suspense fallback={<div>Loading Avatar...</div>}>
      <EmbedInner />
    </Suspense>
  );
}
