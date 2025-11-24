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

import EFROChatWindow from "../../components/EFROChatWindow";
import EFROProductCards from "../../components/EFROProductCards";

import {
  ShoppingIntent,
  EfroProduct,
} from "../../lib/products/mockCatalog";
import { buildShopifyAdminProductUrl } from "../../lib/products/shopifyLinks";
import { runSellerBrain } from "../../lib/sales/sellerBrain";


function normalizeTextForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC_INTENT_WORDS = [
  "premium",
  "beste",
  "hochwertig",
  "qualitaet",
  "qualitat",
  "luxus",
  "teuer",
  "billig",
  "guenstig",
  "günstig",
  "discount",
  "spar",
  "rabatt",
  "deal",
  "bargain",
  "geschenk",
  "gift",
  "praesent",
  "praes",
  "present",
  "bundle",
  "set",
  "paket",
  "combo",
  "zeig",
  "zeige",
  "zeigst",
  "mir",
  "was",
  "hast",
  "habe",
  "du",
  "gibt",
  "es",
  "inspiration",
  "suche",
  "suchen",
  "ich",
  "brauche",
  "bitte",
  "danke",
  "dankeschoen",
  "dankeschön",
];

function hasProductKeywordInCatalog(
  userText: string,
  products: EfroProduct[]
): boolean {
  const normText = normalizeTextForSearch(userText);
  if (!normText) return false;

  const words = normText
    .split(" ")
    .filter(
      (w) =>
        w.length >= 3 &&
        !GENERIC_INTENT_WORDS.includes(w)
    );

  if (words.length === 0) return false;

  for (const p of products) {
    const blob = normalizeTextForSearch(
      [
        p.title,
        p.description || "",
        p.category || "",
        ...(p.tags || []),
      ].join(" ")
    );

    if (!blob) continue;

    const match = words.some((w) => blob.includes(w));
    if (match) {
      return true;
    }
  }

  return false;
}

interface ElevenLabsAvatarProps {
  dynamicVariables?: Record<string, string | number | boolean>;
}

function ElevenLabsAvatar({ dynamicVariables }: ElevenLabsAvatarProps) {
  /* ===========================================================
      STATES
  ============================================================ */
  const [allProducts, setAllProducts] = useState<EfroProduct[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<EfroProduct[]>([]);
  const [currentIntent, setCurrentIntent] = useState<ShoppingIntent>("quick_buy");
  const [productsSource, setProductsSource] = useState<string>("loading...");

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
      PRODUCT LOADING
  ============================================================ */

  useEffect(() => {
    let cancelled = false;

    const sellerShopDomain = String(dynamicVariables?.shopDomain ?? "local-dev");

    const loadProducts = async () => {
      try {
        const res = await fetch(`/api/efro/debug-products?shop=${encodeURIComponent(sellerShopDomain)}`, {
          cache: "no-store",
        });

        if (cancelled) return;

        let products: EfroProduct[] = [];
        let source: string = "unknown";

        if (res.ok) {
          const data = await res.json();
          
          if (Array.isArray(data.products) && data.products.length > 0) {
            products = data.products;
            source = typeof data.productsSource === "string" 
              ? data.productsSource 
              : (typeof data.source === "string" ? data.source : "debug-products (no explicit source)");
          } else {
            console.error("[EFRO] Keine Produkte von Shopify erhalten: data.products ist kein Array oder leer", {
              hasProducts: !!data.products,
              isArray: Array.isArray(data.products),
              length: data.products?.length,
            });
          }
        } else {
          console.error("[EFRO] Keine Produkte von Shopify erhalten: HTTP", res.status, res.statusText);
        }

        if (cancelled) return;

        // Debug-Log vor setAllProducts
        console.log("[EFRO AllProducts]", {
          count: products.length,
          titles: products.map((p) => p.title).slice(0, 10),
          source: source,
        });

        setAllProducts(products);
        setProductsSource(source);
      } catch (err) {
        console.error("[EFRO] Keine Produkte von Shopify erhalten:", err);
        if (!cancelled) {
          const products: EfroProduct[] = [];
          console.log("[EFRO AllProducts]", {
            count: products.length,
            titles: [],
            source: "error (API failed)",
          });
          setAllProducts(products);
          setProductsSource("error (API failed)");
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [dynamicVariables?.shopDomain]);

  /* ===========================================================
      SELLER BRAIN INTEGRATION
  ============================================================ */

  const createRecommendations = useCallback(
    (userText: string) => {
      // Optionales Logging: pruefen, ob der Text ein Produkt-Keyword enthaelt
      const hasKeywordInCatalog = hasProductKeywordInCatalog(userText, allProducts);

      // WICHTIG: SellerBrain bekommt IMMER den kompletten Katalog,
      // nicht mehr nur die bisherigen Empfehlungen.
      const brainResult = runSellerBrain(userText, currentIntent, allProducts);

      const recommended = brainResult.recommended ?? [];

      setCurrentIntent(brainResult.intent);

      let list: EfroProduct[] = [];
      let usedFallback = false;

      if (recommended.length > 0) {
        list = recommended;
      } else {
        // Fallback: 3–4 günstige Produkte aus dem gesamten Katalog
        const sorted = [...allProducts].sort(
          (a, b) => (a.price ?? 0) - (b.price ?? 0)
        );
        list = sorted.slice(0, 4);
        usedFallback = true;
      }

      console.log("[EFRO SellerBrain]", {
        userText,
        intent: brainResult.intent,
        recCount: recommended.length,
        usedSourceCount: allProducts.length,
        hasKeywordInCatalog: recommended.length > 0,
        usedFallback,
        shownTitles: list.map((p) => p.title),
      });

      // Chat-Nachricht aus brainResult.replyText soll unverändert bleiben
      // (also NICHT von usedFallback abhängig machen – das regelt SellerBrain selbst).
      setRecommendedProducts(list);

      // EFRO-Antwort aus SellerBrain als Chat-Nachricht hinzufuegen
      if (brainResult.replyText && brainResult.replyText.trim().length > 0) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: brainResult.replyText,
            sender: "efro",
          },
        ]);
      }
    },
    [currentIntent, allProducts, setChatMessages]
  );

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

      const text =
        msg?.text ||
        msg?.message ||
        msg?.responseText ||
        msg?.output_text ||
        msg?.formattedText ||
        msg?.transcript ||
        null;

      if (!text) {
        console.log("Keine Text-Nachricht:", msg);
        return;
      }

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

      /* ===========================================================
         USER VOICE → orange
         Exakte Erkennung:
         ElevenLabs sendet immer:
            type: "input_transcription" oder "input_transcript"
      ============================================================ */
      if (isUserMessage) {
        console.log("USER (Voice or Text):", text);

        // Zusaetzlich: SellerBrain fuer Produktempfehlungen
        createRecommendations(text);

        setChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text,
            sender: "user",
          },
        ]);

        return; // wichtig!
      }

      /* ===========================================================
         EFRO → grau
         (Assistant output immer type: "output_text" oder role: "assistant")
      ============================================================ */
      if (isAssistantMessage) {
        console.log("[ElevenLabs AI ignored]", { message: text });
        // ElevenLabs-AI-Texte (source: "ai") werden explizit ignoriert
        // und NICHT als EFRO-Antwort im Chat angezeigt.
        // EFROs sichtbare Antworten kommen ausschließlich aus SellerBrain (brainResult.replyText).
        return;
      }

      /* ===========================================================
         Fallback → wenn wir es nicht eindeutig zuordnen können
      ============================================================ */
      // Fallback nur wenn weder User noch Assistant erkannt
      if (!isUserMessage && !isAssistantMessage) {
        console.log("[ElevenLabs unknown message type ignored]", { message: text });
        // Fallback-Text wird NICHT mehr im Chat angezeigt
      }
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

  const loadSellerProducts = async (shopDomain: string) => {
    try {
      const url =
        "/api/efro/debug-products?shop=" +
        encodeURIComponent(shopDomain || "local-dev");

      const res = await fetch(url);
      if (!res.ok) {
        console.error("EFRO debug-products error:", await res.text());
        return { products: [], product_details: [] };
      }

      const data = await res.json();
      const products = data.products || [];
      return {
        products,
        product_details: products,
      };
    } catch (err) {
      console.error("EFRO debug-products error:", err);
      return { products: [], product_details: [] };
    }
  };

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
      PRODUCT CLICK HANDLER
  ============================================================ */

  const handleProductClick = useCallback((product: EfroProduct) => {
    const sellerShopDomain = String(dynamicVariables?.shopDomain ?? "local-dev");
    const url = buildShopifyAdminProductUrl(String(product.id), sellerShopDomain);
    if (!url) {
      console.warn("[avatar-seller] could not build admin URL", product);
      alert(`Keine gueltige Admin-URL fuer dieses Produkt ableitbar.\nID: ${product.id}`);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, [dynamicVariables?.shopDomain]);

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
      CHAT SEND
  ============================================================ */

  const handleChatSend = useCallback(async (text: string) => {
    try {
      if (conversation.sendUserMessage) {
        await conversation.sendUserMessage(text);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text,
          sender: "user",
        },
      ]);
      // Zusaetzlich: SellerBrain fuer Produktempfehlungen
      createRecommendations(text);
    } catch (err) {
      console.error("Chat send error:", err);
    }
  }, [conversation, createRecommendations]);

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
        <div>Intent: {currentIntent}</div>
        <div>Recommended: {recommendedProducts.length}</div>
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

      {/* PRODUCT CARDS (unten links) */}
      {recommendedProducts.length > 0 && (
        <div className="fixed bottom-4 left-4 z-30 w-[320px] max-w-[80vw]">
          <EFROProductCards
            products={recommendedProducts}
            title="EFRO empfiehlt dir gerade:"
            variant="compact"
            onProductClick={handleProductClick}
          />
        </div>
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

  // fuer Shopify: ?shop=domain kommt von der Theme Extension
  const shopDomain = searchParams?.shop ?? "local-dev";

  const dynamicVariables = {
    name: "EFRO",
    language: "de",
    userName: "Evren",
    shopDomain,
  };

    return (
    <MascotProvider>
      <main className="w-full h-screen bg-[#FFF8F0]">
        <section className="w-full h-full flex items-center justify-center">
          <MascotClient
            src={mascotUrl}
            artboard="Character"
            inputs={["is_speaking", "gesture"]}
            layout={{
              fit: Fit.Contain,
              alignment: Alignment.BottomRight,
            }}
          >
            <ElevenLabsAvatar dynamicVariables={dynamicVariables} />
          </MascotClient>
        </section>
      </main>
    </MascotProvider>
  );}






