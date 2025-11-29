"use client";

import { useState, useEffect, ReactNode } from "react";
import { MascotProvider, MascotClient, MascotRive, Fit, Alignment } from "@mascotbot-sdk/react";

export type AvatarPreviewProps = {
  src: string; // Pfad zur .riv-Datei im public-Ordner, z. B. "/bear.riv"
  className?: string;
  children?: ReactNode; // Optional: für Kompatibilität mit avatar-seller (wird ignoriert)
};

/**
 * AvatarPreview
 * - einfache, SSR-sichere Preview für lokale .riv-Avatare
 * - verwendet MascotRive (ohne Voice / AI)
 * - Pattern: MascotClient mit src, MascotRive ohne Props (wie in working-avatar/page.tsx)
 */
export function AvatarPreview({ src, className = "", children }: AvatarPreviewProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    console.log("[EFRO AvatarPreview] props received", { src, hasChildren: !!children });
    setHasMounted(true);
  }, [src, children]);

  if (!hasMounted || typeof window === "undefined") {
    console.log("[EFRO AvatarPreview] not mounted yet (SSR/client)", { src });
    return (
      <div
        className={`flex items-center justify-center bg-slate-900/80 ${className}`}
      >
        <div className="text-xs text-slate-500">Lade Avatar…</div>
      </div>
    );
  }

  if (!src || typeof src !== "string" || !src.endsWith(".riv")) {
    console.warn("[EFRO AvatarPreview] Invalid src prop:", src);
    return (
      <div
        className={`flex items-center justify-center bg-slate-900/80 ${className}`}
      >
        <div className="text-xs text-red-400">Ungültiger Avatar-Pfad</div>
      </div>
    );
  }

  console.log("[EFRO AvatarPreview] Rendering MascotClient with src", { src });

  // TypeScript-Workaround für MascotClient/MascotRive Props
  const MascotClientAny = MascotClient as any;
  const MascotRiveAny = MascotRive as any;

  // Pattern aus working-avatar/page.tsx:
  // MascotClient hat src, artboard, inputs, layout
  // MascotRive hat keine Props (nutzt die vom Client)
  return (
    <MascotProvider>
      <div className={className}>
        <MascotClientAny
          key={src} // erzwingt Remount bei Avatar-Wechsel
          src={src}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{
            fit: Fit.Contain,
            alignment: Alignment.BottomCenter,
          }}
        >
          <MascotRiveAny />
          {children}
        </MascotClientAny>
      </div>
    </MascotProvider>
  );
}
