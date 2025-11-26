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
import { EfroProductPanel } from "@/components/EfroProductPanel";
import { EfroProduct, ShoppingIntent } from "@/lib/products/mockCatalog";
import { runSellerBrain, SellerBrainResult } from "@/lib/sales/sellerBrain";

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

      // 🔇 ElevenLabs-Idle-Prompts ignorieren
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

  // Komplettes SellerBrain-Result für Panel
  const [sellerResult, setSellerResult] = useState<SellerBrainResult | null>(null);

  // 🔹 Plan-State (starter / pro / enterprise)
  const [shopPlan, setShopPlan] = useState<string>("starter");

  /* ===========================================================
      KATALOG-DEBUG-FUNKTION
  ============================================================ */

  const debugCatalogOverview = (products: EfroProduct[]) => {
    const categories = Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter((c): c is string => !!c && c.trim().length > 0)
      )
    );

    console.log("[EFRO Catalog Debug] Übersicht", {
      totalProducts: products.length,
      categories,
      sample: products.slice(0, 20).map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        category: p.category,
        tags: (p as any).tags,
      })),
    });
  };

  /* ===========================================================
      PRODUKTE LADEN
  ============================================================ */

// src/app/avatar-seller/page.tsx

const fetchProducts = useCallback(async () => {
  try {
    // Wichtig: hier holen wir UNSERE gemappten EfroProducts,
    // nicht mehr das rohe Shopify-JSON
    const res = await fetch(`/api/efro/debug-products`, {
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("[EFRO AllProducts] HTTP error from debug-products", {
        status: res.status,
        body: text,
      });
      return;
    }

    const data = await res.json();

    // debug-products liefert ein Objekt mit { products: EfroProduct[], ... }
    const products: EfroProduct[] = Array.isArray(data)
      ? (data as EfroProduct[])
      : Array.isArray(data.products)
      ? (data.products as EfroProduct[])
      : [];

    const titles = products.slice(0, 10).map((p) => p.title);
    console.log("[EFRO AllProducts]", {
      count: products.length,
      titles,
      source: data.productsSource ?? "debug-products",
    });

    setAllProducts(products);
    debugCatalogOverview(products);
  } catch (err) {
    console.error("[EFRO AllProducts] Fetch error", err);
  }
}, []); // shopDomain hier egal, debug-products holt selbst aus /api/shopify-products


  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ===========================================================
      SHOP-META / PLAN LADEN
  ============================================================ */

  const fetchShopMeta = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/efro/shop-meta?shop=${encodeURIComponent(shopDomain)}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const data = await res.json();
      const plan = data?.meta?.plan || "starter";
      const normalizedPlan = String(plan).toLowerCase();
      setShopPlan(normalizedPlan);
      console.log("[EFRO ShopMeta]", {
        shopDomain,
        plan: normalizedPlan,
        meta: data.meta,
      });
    } catch (err) {
      console.error("[EFRO ShopMeta] Fetch error", err);
      setShopPlan("starter");
    }
  }, [shopDomain]);

  useEffect(() => {
    fetchShopMeta();
  }, [fetchShopMeta]);

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
        allProducts,
        shopPlan // <- Plan geht in die Filter-Logik
      );

      console.log("[EFRO SellerBrain]", {
        userText,
        intent: result.intent,
        plan: shopPlan,
        recCount: result.recommended.length,
        usedSourceCount: allProducts.length,
        hasKeywordInCatalog: result.recommended.length > 0,
      });

      // Komplettes Result für Panel speichern
      setSellerResult(result);

      setSellerIntent(result.intent);
      setSellerReplyText(result.replyText);
      setSellerRecommended(result.recommended);
    },
    [allProducts, sellerIntent, shopPlan]
  );

  /* ===========================================================
      UI: PRODUKT-EMPFEHLUNGEN (alte UI entfernt, neue Komponente)
  ============================================================ */

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

        {/* PRODUKT-PANEL – neue Komponente */}
        <EfroProductPanel
          visible={!!sellerResult && sellerResult.recommended.length > 0}
          products={sellerResult?.recommended ?? []}
          replyText={sellerResult?.replyText ?? ""}
        />
      </main>
    </MascotProvider>
  );
}
