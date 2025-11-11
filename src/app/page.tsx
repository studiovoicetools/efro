'use client';

// app/page.tsx
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

const globalConversation: { current: any } = { current: null };

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

/* ---------------- Chat Interface ---------------- */
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
          text: "Hallo! Ich bin Charlie. Sage â€Zeig mir Hoodiesâ€œ oder â€T-Shirtsâ€œ!",
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
    setMessages((p) => [...p, msg]);
    onSendMessage(inputText);
    setInputText("");
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-96 flex flex-col bg-white/95 backdrop-blur rounded-2xl border-2 border-orange-200 shadow-xl mb-4">
      <div className="p-3 border-b border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-2xl font-semibold text-gray-800">
        ğŸ’¬ Charlie â€“ Verkaufsassistent
      </div>
      <div className="flex-1 p-3 overflow-y-auto text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"} mb-2`}>
            <div
              className={`max-w-[75%] px-3 py-2 rounded-2xl ${
                m.sender === "user" ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-800"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
        {products.length > 0 && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-xl">
            <div className="text-green-700 font-medium mb-2">ğŸ›ï¸ Gefundene Produkte ({products.length})</div>
            <div className="grid grid-cols-2 gap-2">
              {products.slice(0, 2).map((p) => (
                <a key={p.id} href={p.url} target="_blank" className="flex gap-2 p-2 bg-white rounded-lg border border-green-100">
                  <img src={p.imageUrl || "/placeholder-product.jpg"} alt={p.title} className="w-8 h-8 rounded object-cover" />
                  <div className="text-xs">{p.title}</div>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-orange-100 flex gap-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Schreibe hier â€¦"
          className="flex-1 px-3 py-2 text-sm border border-orange-200 rounded-xl resize-none"
        />
        <button onClick={send} disabled={!inputText.trim()} className="px-3 bg-orange-500 text-white rounded-xl disabled:opacity-40">
          Senden
        </button>
      </div>
    </div>
  );
}

/* ---------------- Hauptkomponente ---------------- */
function ElevenLabsAvatar({ dynamicVariables }: { dynamicVariables?: Record<string, any> }) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const [showCheckoutOverlay, setShowCheckoutOverlay] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [listening, setListening] = useState(false);
  const [lastHeard, setLastHeard] = useState("");
  const [manualListening, setManualListening] = useState(false);

  const conversation = useConversation({
    micMuted: isMuted,
    onConnect: () => {
      setIsConnecting(false);
      setConnectionStatus("connected");
      globalConversation.current = conversation;
    },
    onDisconnect: () => setConnectionStatus("disconnected"),
  });
  const { isIntercepting } = useMascotElevenlabs({ conversation, gesture: true });

  /* ---- Speak Helper ---- */
  const speak = async (text: string) => {
    const c = globalConversation.current;
    if (c && typeof c.send === "function") await c.send({ text });
  };

  /* ---- Produkt- und Cross-Sell-Logik ---- */
  const fetchProductsFromShopify = async (category?: string) => {
    try {
      const res = await fetch(`/api/shopify-products?category=${category || ""}`);
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch {
      console.warn("Produktsuche fehlgeschlagen");
    }
  };
  const fetchCrossSell = async (category: string) => {
    try {
      const res = await fetch(`/api/cross-sell?category=${category}`);
      const data = await res.json();
      if (data.success && data.related?.length) {
        await speak(`Dazu passen auch ${data.related.join(", ")}.`);
        for (const r of data.related.slice(0, 2)) await fetchProductsFromShopify(r);
      }
    } catch (err) {
      console.warn("Cross-Sell Fehler:", err);
    }
  };

  /* ---- Checkout ---- */
  const handleCheckout = async () => {
    setShowCheckoutOverlay(true);
    setIsCheckoutLoading(true);
    await speak("Ich Ã¶ffne jetzt deinen Warenkorb â€¦");
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: "testprodukt", quantity: 1 }),
      });
      const data = await res.json();
      if (data?.checkoutUrl) {
        await speak("Fertig! Ich Ã¶ffne die Bezahlseite.");
        setTimeout(() => {
          window.open(data.checkoutUrl, "_blank");
          setShowCheckoutOverlay(false);
        }, 1500);
      } else {
        await speak("Ich konnte keinen Warenkorb finden.");
        setShowCheckoutOverlay(false);
      }
    } catch {
      await speak("Da ist ein Fehler passiert.");
      setShowCheckoutOverlay(false);
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  /* ---- Sprachsteuerung ---- */
  const handleUserText = useCallback(async (text: string) => {
    const t = text.toLowerCase();
    setLastHeard(t);

    if (t.includes("hoodie")) {
      await speak("Ich suche Hoodies â€¦");
      await fetchProductsFromShopify("hoodie");
      await fetchCrossSell("hoodie");
    } else if (t.includes("shirt")) {
      await speak("Ich zeige dir T-Shirts â€¦");
      await fetchProductsFromShopify("shirt");
      await fetchCrossSell("shirt");
    } else if (t.includes("jacke")) {
      await speak("Ich zeige dir Jacken â€¦");
      await fetchProductsFromShopify("jacke");
      await fetchCrossSell("jacke");
    } else if (t.includes("cap")) {
      await speak("Ich suche Caps â€¦");
      await fetchProductsFromShopify("cap");
      await fetchCrossSell("cap");
    } else if (t.includes("kasse") || t.includes("bezahlen")) {
      await handleCheckout();
    } else {
      await speak("Sag z. B. â€Zeig mir Hoodiesâ€œ oder â€Zur Kasseâ€œ.");
    }
  }, []);

  /* ---- Voice-Session ---- */
  const startConversation = async () => {
    setIsConnecting(true);
    await navigator.mediaDevices.getUserMedia({ audio: true });
    setIsConnecting(false);
    setConnectionStatus("connected");
    setListening(true);
  };
  const stopConversation = async () => {
    setConnectionStatus("disconnected");
    setListening(false);
  };

  /* ---- UI ---- */
  return (
    <>
      {/* Debug oben links */}
      <div className="fixed top-4 left-4 z-50 bg-black/90 text-white p-4 rounded-2xl text-sm font-mono min-w-80 border border-gray-700">
        <div>ğŸ”Œ {connectionStatus}</div>
        <div>ğŸ¤ {listening ? "Listening" : "Idle"}</div>
        <div>ğŸ’¬ Chat {isChatOpen ? "OPEN" : "CLOSED"}</div>
        <div>ğŸ“¦ Produkte: {products.length}</div>
        <div>ğŸ§  LipSync: {isIntercepting ? "On" : "Off"}</div>
        <div>ğŸ™ï¸ Mic: {isMuted ? "Mute" : "Live"}</div>
        <div className="mt-1 border-t border-gray-600 pt-1 text-xs opacity-80">Letzter Befehl: {lastHeard || "â€”"}</div>
      </div>

      {/* Avatar UI unten rechts */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
        <ChatInterface onSendMessage={handleUserText} products={products} isOpen={isChatOpen} />
        <div className="w-80 h-80 bg-white/95 border-2 border-orange-200 shadow-2xl rounded-2xl overflow-hidden mb-4">
          <MascotRive />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`h-12 px-4 rounded-lg border-2 shadow-lg ${
              isChatOpen ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-800 border-orange-200"
            }`}
          >
            {isChatOpen ? "ğŸ’¬ Chat schlieÃŸen" : "ğŸ’¬ Chat Ã¶ffnen"}
          </button>

          {connectionStatus === "connected" ? (
            <>
              <button onClick={stopConversation} className="h-12 px-4 bg-red-500 text-white rounded-lg shadow-lg">
                Stop
              </button>
              <button onClick={() => setIsMuted(!isMuted)} className="h-12 px-4 bg-white border rounded-lg shadow-lg">
                {isMuted ? "ğŸ”‡ Stumm" : "ğŸ¤ Aktiv"}
              </button>
              <button
                onClick={handleCheckout}
                disabled={isCheckoutLoading}
                className={`h-12 px-4 rounded-lg shadow-lg ${
                  isCheckoutLoading ? "bg-emerald-300" : "bg-emerald-500 hover:bg-emerald-600"
                } text-white`}
              >
                {isCheckoutLoading ? "â³ Ã–ffne Kasse â€¦" : "ğŸ›’ Zur Kasse"}
              </button>
            </>
          ) : (
            <button
              onClick={startConversation}
              disabled={isConnecting}
              className={`h-12 px-6 rounded-lg text-white shadow-lg ${
                isConnecting ? "bg-orange-400" : "bg-orange-500 hover:bg-orange-600"
              }`}
            >
              {isConnecting ? "ğŸ”„ Verbindeâ€¦" : "ğŸ¤ Mit Charlie sprechen"}
            </button>
          )}
        </div>
      </div>

      {/* Checkout Overlay mit Shopify-Logo */}
      {showCheckoutOverlay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-[9999] text-white">
          <div className="flex flex-col items-center gap-6 animate-fadeIn">
            <div className="relative w-20 h-20 animate-spin-slow">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-full h-full text-emerald-400" fill="currentColor">
                <path d="M370.3 105.4c-5.3-2.1-10.7-3.9-16.1-5.3..." />
              </svg>
            </div>
            <h2 className="text-xl font-semibold tracking-wide">Kasse wird geÃ¶ffnet â€¦</h2>
            <p className="text-sm opacity-75">Bitte einen Moment Geduld</p>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- Wrapper ---------------- */
export default function Home() {
  const mascotUrl = "/mascot-v2.riv";
  const dynamicVariables = { name: "Charlie" };
  return (
    <MascotProvider>
      <main className="w-full h-screen">
        <MascotClient src={mascotUrl} artboard="Character" inputs={["is_speaking", "gesture"]} layout={{ fit: Fit.Contain, alignment: Alignment.BottomRight }}>
          <ElevenLabsAvatar dynamicVariables={dynamicVariables} />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}


