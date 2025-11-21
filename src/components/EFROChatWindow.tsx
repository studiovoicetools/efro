"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "efro";
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
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`px-3 py-2 rounded-xl ${
                m.sender === "user"
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
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
