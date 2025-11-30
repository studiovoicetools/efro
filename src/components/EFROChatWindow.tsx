"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  text: string;
  role: "user" | "efro";
  createdAt: number;
}

export default function EFROChatWindow({
  isOpen,
  onClose,
  onSend,
  messages
}: {
  isOpen: boolean;
  onClose: () => void;
  onSend: (msg: string) => void;
  messages: Message[];
}) {
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const send = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="fixed right-4 bottom-[25rem] w-80 max-h-[26rem] bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      <div className="p-3 border-b font-semibold text-gray-700 flex justify-between">
        EFRO Chat
        <button onClick={onClose} className="text-gray-500">✕</button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto text-sm space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-zinc-500 italic">
            EFRO wartet auf deine Frage…
          </div>
        )}
        {messages.map((m) => {
          // Unterstützung für altes Format (sender) und neues Format (role)
          const role = (m as any).role || (m as any).sender || "efro";
          
          // Robustere Text-Extraktion (wie im Debug-Overlay)
          const text =
            (m as any).text ??
            (m as any).replyText ??
            (typeof (m as any).content === "string"
              ? (m as any).content
              : Array.isArray((m as any).content)
              ? (m as any).content
                  .map((c: any) =>
                    typeof c === "string"
                      ? c
                      : "text" in c
                      ? c.text
                      : ""
                  )
                  .join(" ")
              : "");

          if (!text) {
            console.warn("[EFRO ChatWindow] message ohne text", m);
            return null;
          }

          return (
            <div
              key={m.id}
              className={`mb-2 flex ${
                role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  role === "user"
                    ? "bg-orange-500 text-white"
                    : "bg-white text-gray-900 border border-gray-200"
                }`}
              >
                {text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="p-2 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          placeholder="Schreiben..."
        />

        <button
          onClick={send}
          className="px-3 py-2 bg-orange-500 text-white rounded-lg"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
