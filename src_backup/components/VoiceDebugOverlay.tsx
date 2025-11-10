"use client";
import { useEffect, useRef } from "react";

type Props = {
  connected: boolean;
  lastText?: string;
  listening: boolean;
};

export default function VoiceDebugOverlay({ connected, lastText, listening }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listening && ref.current) {
      ref.current.classList.remove("opacity-60");
      ref.current.classList.add("opacity-100");
      const t = setTimeout(() => {
        ref.current?.classList.remove("opacity-100");
        ref.current?.classList.add("opacity-60");
      }, 800);
      return () => clearTimeout(t);
    }
  }, [listening, lastText]);

  return (
    <div
      ref={ref}
      className="fixed bottom-6 left-6 z-50 px-3 py-2 rounded-xl shadow-md border bg-white/90 backdrop-blur-sm text-sm opacity-60 transition-opacity"
    >
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-500" : "bg-red-400"}`} />
        <b>Voice Link:</b> {connected ? "connected" : "disconnected"}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${listening ? "bg-green-500" : "bg-gray-300"}`} />
        <span>listening</span>
      </div>
      {lastText ? (
        <div className="mt-2 max-w-[260px] truncate">
          <span className="text-neutral-500">last:</span> “{lastText}”
        </div>
      ) : null}
    </div>
  );
}

