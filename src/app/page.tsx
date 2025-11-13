"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  Alignment,
  Fit,
  MascotClient,
  MascotProvider,
  MascotRive,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";

/* ---------------- Types ---------------- */
interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string;
  compareAtPrice: string | null;
  url: string;
  available: boolean;
  category: string;
}

/* ===========================================================
   GLOBAL SPEAK SESSION
=========================================================== */

const globalConversation: { current: any } = { current: null };

async function speak(text: string) {
  const c = globalConversation.current;
  if (c && typeof c.send === "function") {
    await c.send({ text });
  }
}

/* ===========================================================
   CHAT UI
=========================================================== */

function ChatInterface({
  onSendMessage,
  products,
  isOpen,
}: {
  onSendMessage: (message: string) => void;
  products: Product[];
  isOpen: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: "1",
          text: "Hallo, ich bin EFRO. Sage: Zeig mir Hoodies oder Zeig mir T-Shirts.",
          sender: "assistant",
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    if (!inputText.trim()) return;
    const msg: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, msg]);
    onSendMessage(inputText);
    setInputText("");
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-96 flex flex-col bg-white rounded-2xl border border-orange-300 shadow-lg mb-4">
      <div className="p-3 border-b border-orange-200 bg-orange-50 rounded-t-2xl font-semibold text-gray-800">
        EFRO Verkaufs-Chat
      </div>

      <div className="flex-1 p-3 overflow-y-auto text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.sender === "user" ? "justify-end" : "justify-start"
            } mb-2`}
          >
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl ${
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

        {products.length > 0 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-xl">
            <div className="text-green-700 font-medium mb-2">
              Produkte gefunden ({products.length})
            </div>

            <div className="grid grid-cols-2 gap-2">
              {products.slice(0, 2).map((p) => (
                <a
                  key={p.id}
                  href={p.url}
                  target="_blank"
                  className="flex gap-2 p-2 bg-white rounded-lg border border-green-200"
                >
                  <img
                    src={p.imageUrl || "/placeholder-product.jpg"}
                    alt={p.title}
                    className="w-8 h-8 rounded object-cover"
                  />
                  <div className="text-xs">{p.title}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-orange-200 flex gap-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Schreibe hier..."
          className="flex-1 px-3 py-2 text-sm border border-orange-300 rounded-xl resize-none"
        />

        <button
          onClick={send}
          disabled={!inputText.trim()}
          className="px-3 bg-orange-500 text-white rounded-xl disabled:opacity-40"
        >
          Senden
        </button>
      </div>
    </div>
  );
}

/* ===========================================================
   AVATAR LOGIC
=========================================================== */

function ElevenLabsAvatar() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [listening, setListening] = useState(false);
  const [lastCommand, setLastCommand] = useState("");

  /* Voice session */
  const conversation = useConversation({
    micMuted: isMuted,
    onConnect: () => {
      setConnectionStatus("connected");
      globalConversation.current = conversation;
    },
    onDisconnect: () => setConnectionStatus("disconnected"),
  });

  const { isIntercepting } = useMascotElevenlabs({
    conversation,
    gesture: true,
  });

  /* Load Shopify Products */
  async function loadProducts(category: string) {
    try {
      const res = await fetch("/api/shopify-products?category=" + category);
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch {}
  }

  /* Explain Product */
  async function explain(handle: string, question: string) {
    const res = await fetch("/api/explain-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle, question }),
    });

    const data = await res.json();
    if (data.ok) await speak(data.answer);
  }

  /* Handle User Input */
  const handleUserText = useCallback(
    async (text: string) => {
      const t = text.toLowerCase();
      setLastCommand(t);

      if (t.includes("hoodie")) {
        await speak("Ich suche Hoodies.");
        await loadProducts("hoodie");
        return;
      }

      if (t.includes("shirt")) {
        await speak("Ich zeige dir T-Shirts.");
        await loadProducts("shirt");
        return;
      }

      if (t.includes("was kostet")) {
        if (products[0]) {
          await explain(products[0].handle, t);
        } else {
          await speak("Bitte zuerst ein Produkt anzeigen lassen.");
        }
        return;
      }

      await speak("Sag zum Beispiel: Zeig mir Hoodies.");
    },
    [products]
  );

  /* ===========================================================
     CORRECT ElevenLabs Session Start
  ============================================================ */
  async function startConversation() {
    try {
      setIsConnecting(true);

      await navigator.mediaDevices.getUserMedia({ audio: true });

      await conversation.startSession();

      await conversation.send({ type: "input_stream_open" });

      setListening(true);
      setConnectionStatus("connected");
      globalConversation.current = conversation;
    } catch (err) {
      console.error("startConversation ERROR:", err);
      setConnectionStatus("error");
    } finally {
      setIsConnecting(false);
    }
  }

  return (
    <>
      {/* Debug info */}
      <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-2xl text-sm font-mono">
        <div>Status: {connectionStatus}</div>
        <div>Listening: {listening ? "yes" : "no"}</div>
        <div>Chat: {isChatOpen ? "open" : "closed"}</div>
        <div>Products: {products.length}</div>
        <div>LipSync: {isIntercepting ? "yes" : "no"}</div>
        <div>Mic: {isMuted ? "muted" : "open"}</div>
        <div className="opacity-60 mt-2">Last: {lastCommand}</div>
      </div>

      {/* Avatar Box + Chat */}
      <div className="fixed bottom-4 right-4 flex flex-col items-end">
        <ChatInterface
          onSendMessage={handleUserText}
          products={products}
          isOpen={isChatOpen}
        />

        <div className="w-80 h-80 bg-white border border-orange-300 shadow-2xl rounded-2xl overflow-hidden mb-4">
          <MascotRive />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="h-12 px-4 rounded-lg border shadow bg-white"
          >
            {isChatOpen ? "Chat schliessen" : "Chat oeffnen"}
          </button>

          <button
            onClick={startConversation}
            disabled={isConnecting}
            className="h-12 px-6 rounded-lg text-white shadow bg-orange-500"
          >
            {isConnecting ? "Verbinde..." : "Mit EFRO sprechen"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ===========================================================
   WRAPPER
=========================================================== */

export default function Home() {
  const mascotUrl = "/mascot-v2.riv";

  return (
    <MascotProvider>
      <main className="w-full h-screen">
        <MascotClient
          src={mascotUrl}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{ fit: Fit.Contain, alignment: Alignment.BottomRight }}
        >
          <ElevenLabsAvatar />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
