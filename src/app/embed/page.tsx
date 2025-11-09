"use client";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Render-sicherer Embed-Wrapper für Efro Avatar.
 * - Kein Prerendering
 * - Suspense korrekt verwendet
 * - useSearchParams nur im Client
 * - Keine ungültigen revalidate-Typen
 */

function EmbedInner() {
  const params = useSearchParams();
  const shop = params.get("shop");
  const mode = params.get("mode");

  const query = new URLSearchParams();
  if (shop) query.set("shop", shop);
  if (mode) query.set("mode", mode);

  const src = `/avatar-embed${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <iframe
      src={src}
      title="Efro Avatar Embed"
      style={{
        width: "100vw",
        height: "100vh",
        border: "none",
        overflow: "hidden",
      }}
      allow="microphone; autoplay; clipboard-read; clipboard-write;"
    />
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading Efro…</div>}>
      <EmbedInner />
    </Suspense>
  );
}
