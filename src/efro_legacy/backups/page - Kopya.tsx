"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Alignment,
  Fit,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";

import EFROChatWindow from "@/components/EFROChatWindow";
import {
  EfroProduct,
  ShoppingIntent,
} from "@/lib/products/mockCatalog";
import {
  runSellerBrain,
  SellerBrainResult,
} from "@/lib/sales/sellerBrain";

/* ===========================================================
   AVATAR COMPONENT
=========================================================== */

interface ElevenLabsAvatarProps {
  dynamicVariables?: Record<string, string | number | boolean>;

  // Wird von Home übergeben – hier hängt SellerBrain dran
  createRecommendations?: (text: string) => void;
}

function ElevenLabsAvatar({
  dynamicVariables,
  createRecommendations,
}: ElevenLabsAvatarProps) {
  /* ===========================================================
      STATES
  ============================================================ */
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [chatMessages, setChatMessages] = useState<
    { id: string; text: string; sender: "user" | "efro" }[]
  >([]);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  const urlRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTime = useRef<number | null>(null);
  const [debugStatus, setDebugStatus] = useState("idle");

  /* LipSync */
  const [naturalLipSyncEnabled] = useState(true);
  const [lipSyncConfig] = useState({
    minVisemeInterval: 40,
    mergeWindow: 60,
    keyVisemePreference: 0.6,
    preserveSilence: true,
    similarityThreshold: 0.4,
    preserveCriticalVisemes: true,
    criticalVisemeMinDuration: 80,
  });

  /* ===========================================================
      ELEVENLABS CONVERSATION
  ============================================================ */

  const conversation = useConversation({
    micMuted: isMuted,

    onConnect: () => {
      console.log("ElevenLabs Connected");
      setIsConnecting(false);
      setDebugStatus("connected");

      if (connectionStartTime.current) {
        console.log("Connected in:", Date.now() - connectionStartTime.current);
        connectionStartTime.current = null;
      }
    },

    onDisconnect: () => {
      console.log("ElevenLabs Disconnected");
      setDebugStatus("disconnected");
    },

    onError: (error: any) => {
      console.error("ElevenLabs Error:", error);
      setDebugStatus("error");
    },

    /* ===========================================================
        INCOMING MESSAGES (VOICE + EFRO)
    ============================================================ */
    onMessage: (msg: any) => {
      console.log("RAW-IN:", msg);

      const rawText =
        msg?.text ||
        msg?.message ||
        msg?.responseText ||
        msg?.output_text ||
        msg?.formattedText ||
        msg?.transcript ||
        null;

      if (!rawText) {
        console.log("Keine Text-Nachricht:", msg);
        return;
      }

      const text = String(rawText);
      const cleanText = text.trim();
      const normalized = cleanText.toLowerCase();

      // Gibt es überhaupt Buchstaben/Ziffern?
      const hasLettersOrDigits = /[a-z0-9äöüß]/i.test(cleanText);

      const isUserMessage =
        msg.type === "input_transcript" ||
        msg.type === "input_transcription" ||
        msg.source === "user" ||
        msg.role === "user";

      const isAssistantMessage =
        msg.role === "assistant" ||
        msg.type === "output_text" ||
        msg.type === "response_output" ||
        !!msg.output_audio ||
        !!msg.audio_output ||
        msg.source === "assistant" ||
        msg.source === "ai";

      // 🔇 ElevenLabs-Idle-Prompts ("Bist du noch da?" etc.) komplett ignorieren
      if (
        isAssistantMessage &&
        (normalized.includes("bist du noch da") ||
          normalized.includes(
            "gibt es noch etwas, womit ich dir helfen kann"
          ) ||
          normalized.includes("ich sehe, du hast nichts gesagt") ||
          normalized.includes(
            "kann ich dir noch irgendwie behilflich sein"
          ) ||
          normalized.includes("are you still there"))
      ) {
        console.log("[ElevenLabs idle prompt ignored]", { text: cleanText });
        return;
      }

      /* ===========================================================
         USER VOICE → orange
      ============================================================ */
      if (isUserMessage) {
        // 🔇 HARTE Bremse:
        // wenn keine Buchstaben/Ziffern → nur Noise (z.B. "...", "??", "!!")
        if (!hasLettersOrDigits) {
          console.log("[USER noise ignored - no letters/digits]", {
            text: cleanText,
            raw: msg,
          });
          return;
        }

        console.log("USER (Voice or Text):", cleanText);

        // Produktempfehlungen nur für ECHTEN User-Text
        if (typeof createRecommendations === "function") {
          createRecommendations(cleanText);
        } else {
          console.log(
            "[EFRO] createRecommendations nicht gesetzt – Katalog-Logik wird übersprungen."
          );
        }

        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: cleanText,
            sender: "user",
          },
        ]);

        return;
      }

      /* ===========================================================
         EFRO (Assistant) → nur für LipSync, NICHT als Chat-Nachricht
      ============================================================ */
      if (isAssistantMessage) {
        console.log("[ElevenLabs AI ignored]", { message: cleanText });
        // Wir zeigen diese Texte nicht im Chat und triggern auch
        // KEINE neuen Produktempfehlungen.
        return;
      }

      /* ===========================================================
         Fallback → unsaubere Typen ignorieren
      ============================================================ */
      console.log("[ElevenLabs unknown message type ignored]", {
        message: cleanText,
        raw: msg,
      });
    },
  });

  /* ===========================================================
      LIPSYNC HOOK
  ============================================================ */

  useMascotElevenlabs({
    conversation,
    gesture: true,
    naturalLipSync: naturalLipSyncEnabled,
    naturalLipSyncConfig: lipSyncConfig,
  });

  /* ===========================================================
      SIGNED URL
  ============================================================ */

  const getSignedUrl = async (): Promise<string> => {
    const response = await fetch(`/api/get-signed-url-seller`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dynamicVariables: dynamicVariables || {} }),
    });

    const data = await response.json();
    return data.signedUrl;
  };

  const fetchAndCacheUrl = useCallback(async () => {
    try {
      const url = await getSignedUrl();
      setCachedUrl(url);
    } catch (error) {
      console.error("Failed signed URL:", error);
      setCachedUrl(null);
    }
  }, [dynamicVariables]);

  useEffect(() => {
    fetchAndCacheUrl();
    urlRefreshInterval.current = setInterval(fetchAndCacheUrl, 9 * 60 * 1000);

    return () => {
      if (urlRefreshInterval.current) clearInterval(urlRefreshInterval.current);
    };
  }, [fetchAndCacheUrl]);

  /* ===========================================================
      SESSION CONTROL
  ============================================================ */

  const startConversation = useCallback(async () => {
    try {
      setIsConnecting(true);
      setDebugStatus("connecting");
      connectionStartTime.current = Date.now();

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signedUrl = cachedUrl || (await getSignedUrl());

      await conversation.startSession({
        signedUrl,
        dynamicVariables,
      });

      setDebugStatus("connected");
    } catch (error) {
      console.error("Start error:", error);
      setIsConnecting(false);
      setDebugStatus("error");
    }
  }, [conversation, cachedUrl, dynamicVariables]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    setDebugStatus("disconnected");
  }, [conversation]);

  const toggleMute = useCallback(() => {
    setIsMuted((v) => !v);
  }, []);

  /* ===========================================================
      CHAT SEND (Textchat-Feld)
  ============================================================ */

  const handleChatSend = async (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;

    try {
      if (conversation.sendUserMessage) {
        await conversation.sendUserMessage(cleaned);
      }

      // Auch Text-Chat → SellerBrain
      if (typeof createRecommendations === "function") {
        createRecommendations(cleaned);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: cleaned,
          sender: "user",
        },
      ]);
    } catch (err) {
      console.error("Chat send error:", err);
    }
  };

  /* ===========================================================
      RENDER
  ============================================================ */

  return (
    <>
      {/* DEBUG BOX */}
      <div className="fixed top-4 left-4 bg-black/80 text-white p-4 rounded-xl text-sm z-50">
        <div>Status: {debugStatus}</div>
        <div>Mic muted: {isMuted ? "yes" : "no"}</div>
        <div>Connecting: {isConnecting ? "yes" : "no"}</div>
      </div>

      {/* CHAT WINDOW */}
      {isChatOpen && (
        <EFROChatWindow
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSend={handleChatSend}
          messages={chatMessages}
        />
      )}

      {/* AVATAR + BUTTONS */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
        <div className="w-80 h-80 pointer-events-none">
          <MascotRive />
        </div>

        <div className="flex gap-3">
          {conversation.status === "connected" ? (
            <>
              <button
                onClick={stopConversation}
                className="h-12 px-5 bg-red-500 text-white rounded-lg shadow"
              >
                Mit EFRO auflegen
              </button>

              <button
                onClick={toggleMute}
                className="h-12 px-5 bg-white text-gray-800 border rounded-lg shadow"
              >
                {isMuted ? "Mikro an" : "Mikro aus"}
              </button>
            </>
          ) : (
            <button
              onClick={startConversation}
              disabled={isConnecting}
              className="h-12 px-6 bg-orange-500 text-white rounded-lg shadow disabled:opacity-50"
            >
              {isConnecting ? "Verbinde…" : "Mit EFRO sprechen"}
            </button>
          )}

          <button
            onClick={() => setIsChatOpen(true)}
            className="h-12 px-5 bg-white text-gray-800 border rounded-lg shadow"
          >
            Chat öffnen
          </button>
        </div>
      </div>
    </>
  );
}

/* ===========================================================
   HOME WRAPPER (mit Shopify shop Param)
=========================================================== */

type HomeProps = {
  searchParams?: {
    shop?: string;
  };
};

export default function Home({ searchParams }: HomeProps) {
  const mascotUrl = "/retroBot.riv";

  // für Shopify: ?shop=domain kommt von der Theme Extension
  const shopDomain = searchParams?.shop ?? "local-dev";

  const dynamicVariables = {
    name: "EFRO",
    language: "de",
    userName: "Evren",
    shopDomain,
  };

  // 🔹 Produkt- und SellerBrain-State
  const [allProducts, setAllProducts] = useState<EfroProduct[]>([]);
  const [sellerIntent, setSellerIntent] =
    useState<ShoppingIntent>("quick_buy");
  const [sellerReplyText, setSellerReplyText] = useState("");
  const [sellerRecommended, setSellerRecommended] = useState<EfroProduct[]>(
    []
  );

  /* ===========================================================
      PRODUKTE LADEN
  ============================================================ */

  const fetchProducts = useCallback(async () => {
    try {
      // Passe den Endpoint ggf. an deine API an
      const res = await fetch(
        `/api/shopify-products?shop=${encodeURIComponent(shopDomain)}`
      );
      const data = await res.json();

      // Viele Backends schicken { products: [...] }
      const products: EfroProduct[] = Array.isArray(data)
        ? data
        : data.products ?? [];

      const titles = products.slice(0, 10).map((p) => p.title);
      console.log("[EFRO AllProducts]", {
        count: products.length,
        titles,
        source: "shopify-products (mapped to EfroProduct)",
      });

      setAllProducts(products);
    } catch (err) {
      console.error("[EFRO AllProducts] Fetch error", err);
    }
  }, [shopDomain]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ===========================================================
      SELLERBRAIN-BRIDGE (wird vom Avatar aufgerufen)
  ============================================================ */

  const createRecommendations = useCallback(
    (userText: string) => {
      if (!allProducts.length) {
        console.log(
          "[EFRO SellerBrain] Kein Katalog geladen, Empfehlung übersprungen."
        );
        return;
      }

      const result: SellerBrainResult = runSellerBrain(
        userText,
        sellerIntent,
        allProducts
      );

      console.log("[EFRO SellerBrain]", {
        userText,
        intent: result.intent,
        recCount: result.recommended.length,
        usedSourceCount: allProducts.length,
        hasKeywordInCatalog: result.recommended.length > 0,
      });

      setSellerIntent(result.intent);
      setSellerReplyText(result.replyText);
      setSellerRecommended(result.recommended);
    },
    [allProducts, sellerIntent]
  );

  /* ===========================================================
      UI: PRODUKT-EMPFEHLUNGEN UNTEN / LINKS
  ============================================================ */

  const formatPrice = (p: EfroProduct) =>
    p.price != null ? `${p.price.toFixed(2)} €` : "–";

  return (
    <MascotProvider>
      <main className="w-full h-screen bg-[#FFF8F0] relative overflow-hidden">
        {/* AVATAR + VOICE + CHAT */}
        <MascotClient
          src={mascotUrl}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{
            fit: Fit.Contain,
            alignment: Alignment.BottomRight,
          }}
        >
          <ElevenLabsAvatar
            dynamicVariables={dynamicVariables}
            createRecommendations={createRecommendations}
          />
        </MascotClient>

        {/* PRODUKT-PANEL – bleibt unabhängig vom Avatar */}
        <div className="absolute left-4 bottom-4 right-96 max-w-xl z-30">
          <div className="bg-white/90 backdrop-blur shadow-xl rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-gray-900">
                EFROs Produktempfehlungen
              </h2>
              <span className="text-xs text-gray-500">
                Intent: {sellerIntent} · Katalog: {allProducts.length} Produkte
              </span>
            </div>

            {sellerReplyText ? (
              <p className="text-sm text-gray-800 whitespace-pre-line mb-3">
                {sellerReplyText}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-3">
                Stelle EFRO einfach eine Frage wie:
                {" "}
                <span className="italic">
                  „Zeige mir Produkte über 100 Euro“,
                  „Zeige mir Duschgel“,
                  „Zeige mir Produkte in der Kategorie Haushalt“
                </span>
                . EFRO filtert dann live deinen Katalog.
              </p>
            )}

            {sellerRecommended.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sellerRecommended.map((p) => (
                  <div
                    key={p.id ?? p.title}
                    className="border border-gray-200 rounded-xl p-3 bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {p.title}
                    </div>
                    <div className="text-sm text-orange-600 font-bold mb-1">
                      {formatPrice(p)}
                    </div>
                    {p.category && (
                      <div className="text-xs text-gray-500 mb-1">
                        Kategorie: {p.category}
                      </div>
                    )}
                    {p.description && (
                      <div className="text-xs text-gray-600 line-clamp-3">
                        {p.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-500">
                Noch keine konkreten Vorschläge. Sprich mit EFRO oder tippe in den Chat –
                reine Platzhalter wie „...“ oder „??“ werden ignoriert.
              </div>
            )}
          </div>
        </div>
      </main>
    </MascotProvider>
  );
}
