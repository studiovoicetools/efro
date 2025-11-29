"use client";

import { useEffect, useRef, useState } from "react";

type UseBrowserSTTOptions = {
  onText: (text: string) => void;
  autoStart?: boolean;
};

export function useBrowserSTT({ onText, autoStart = false }: UseBrowserSTTOptions) {
  const recognitionRef = useRef<any>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);

  useEffect(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "de-DE";

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);

    rec.onresult = (e: any) => {
      // nimm immer das letzte Resultat
      const res = e.results[e.results.length - 1];
      if (!res) return;
      const text = res[0]?.transcript?.trim();
      const isFinal = res.isFinal;
      if (text && isFinal) {
        onText(text);
      }
    };

    rec.onerror = (err: any) => {
      console.warn("WebSpeech STT error:", err?.error || err);
    };

    recognitionRef.current = rec;

    if (autoStart) {
      try {
        rec.start();
      } catch {}
    }

    return () => {
      try { rec.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, [onText, autoStart]);

  const start = () => {
    try { recognitionRef.current?.start(); } catch {}
  };
  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
  };

  return { supported, listening, start, stop };
}

