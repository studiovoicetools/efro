"use client";

import { logEfroEvent } from "@/lib/efro/logEventClient";

import { useState, useCallback, useEffect, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { getRandomDemoPhrase } from "@/lib/voices/demoPhrases";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Alignment,
  Fit,
  useMascotElevenlabs,
} from "@mascotbot-sdk/react";
import { AvatarPreview } from "@/components/efro/AvatarPreview";

import EFROChatWindow from "@/components/EFROChatWindow";
import { EfroProductPanel } from "@/components/EfroProductPanel";
import {
  EfroProduct,
  ShoppingIntent,
  mockCatalog,
} from "@/lib/products/mockCatalog";
import { efroAttributeTestProducts } from "@/lib/catalog/efro-attribute-test-products";
import { runSellerBrain, SellerBrainResult } from "@/lib/sales/sellerBrain";
import { analyzeCatalogKeywords } from "@/lib/sales/catalogKeywordAnalyzer";
import { buildMascotUrl } from "@/lib/efro/mascotConfig";

/* ===========================================================
   SHOPIFY → EFRO MAPPING
=========================================================== */

type ShopifyProduct = {
  id: number | string;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string; // Komma-getrennt
  variants?: { price?: string }[];
  image?: { src?: string };
};

// HTML grob entfernen
function stripHtml(html?: string): string {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapShopifyToEfro(list: ShopifyProduct[]): EfroProduct[] {
  return (list || []).map((p, index) => {
    const priceNumber = p.variants?.[0]?.price
      ? Number(p.variants[0].price)
      : NaN;

    const safePrice = Number.isFinite(priceNumber) ? priceNumber : 0;

    const tagsArray =
      p.tags
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean) ?? [];

    return {
      id: String(p.id ?? `shopify-${index}`),
      title: p.title || "Unbenanntes Produkt",
      description: stripHtml(p.body_html),
      price: safePrice, // Pflichtfeld
      imageUrl: p.image?.src || "/images/mock/gift-card-50.jpg", // Fallback-Bild
      tags: tagsArray,
      category: p.product_type || "misc",
    };
  });
}

/* ===========================================================
   AVATAR COMPONENT
=========================================================== */

interface ElevenLabsAvatarProps {
  dynamicVariables?: Record<string, string | number | boolean>;

  // Wird von Home übergeben – hier hängt SellerBrain dran
  createRecommendations?: (text: string) => void;
  setChatMessages?: React.Dispatch<
    React.SetStateAction<
      { id: string; text: string; sender: "user" | "efro" }[]
    >
  >;

  // Handler-Registrierung, damit Home EFRO sprechen lassen kann
  registerSpeakHandler?: (fn: ((text: string) => void) | null) => void;
}

function ElevenLabsAvatar({
  dynamicVariables,
  createRecommendations,
  setChatMessages: externalSetChatMessages,
  registerSpeakHandler,
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
  const hasPlayedIntroRef = useRef(false);
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

      // Intro-Phrase einmalig beim ersten Connect abspielen
      if (!hasPlayedIntroRef.current) {
        hasPlayedIntroRef.current = true;

        // TODO: Später language-dynamisch machen (DE/EN) abhängig von Shop-/User-Settings.
        const intro = getRandomDemoPhrase("intro");
        console.log("[EFRO Demo] Playing intro phrase:", intro);

        // 1) Intro als Bot-Nachricht in den Chat schreiben
        const targetSetChatMessages = externalSetChatMessages ?? setChatMessages;
        targetSetChatMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: intro,
            sender: "efro",
          },
        ]);

        // 2) TTS anstoßen (mit kleiner Verzögerung, damit die Verbindung stabil ist)
        // Verwende conversation.sendUserMessage direkt, da speakForApp hier noch nicht verfügbar ist
        setTimeout(() => {
          const fn = (conversation as any)?.sendUserMessage;
          if (typeof fn === "function") {
            const phrase = `Bitte sprich genau folgenden Satz und füge nichts hinzu: "${intro}"`;
            console.log("[EFRO Demo] Sending intro to ElevenLabs:", phrase);
            const maybePromise = fn(phrase);
            if (maybePromise && typeof (maybePromise as any).then === "function") {
              maybePromise.catch((err: any) => {
                console.error("[EFRO Demo] sendUserMessage error", err);
              });
            }
          } else {
            console.warn("[EFRO Demo] sendUserMessage nicht verfügbar für Intro-Phrase");
          }
        }, 500);
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
        // Nur Rauschen (ohne Buchstaben/Ziffern) ignorieren
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

        const targetSetChatMessages = externalSetChatMessages ?? setChatMessages;

        targetSetChatMessages((prev) => [
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
        // keine Chat-Nachricht, keine Recommendations
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
      SPRECH-HANDLER FÜR HOME
  ============================================================ */

  const speakForApp = useCallback(
    async (text: string) => {
      // Einige ElevenLabs-Versionen haben sendUserMessage nicht
      const fn = (conversation as any)?.sendUserMessage;
      if (typeof fn !== "function") {
        console.warn(
          "[EFRO Speak] sendUserMessage ist nicht verfügbar, Text wird nicht gesprochen:",
          text
        );
        return;
      }

      const phrase = `Bitte sprich genau folgenden Satz und füge nichts hinzu: "${text}"`;

      console.log("[EFRO Speak] Sending to ElevenLabs:", phrase);

      try {
        const maybePromise = fn(phrase);
        // Falls ein Promise zurückkommt, warten – ansonsten ignorieren
        if (maybePromise && typeof (maybePromise as any).then === "function") {
          await maybePromise;
        }
      } catch (err) {
        console.error("[EFRO Speak] sendUserMessage error", err);
      }
    },
    [conversation]
  );

  useEffect(() => {
    if (!registerSpeakHandler) return;
    registerSpeakHandler(speakForApp);
    return () => registerSpeakHandler(null);
  }, [registerSpeakHandler, speakForApp]);

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
      const fn = (conversation as any)?.sendUserMessage;
      if (typeof fn === "function") {
        const maybePromise = fn(cleaned);
        if (maybePromise && typeof (maybePromise as any).then === "function") {
          await maybePromise;
        }
      }

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
  const mascotUrl = buildMascotUrl(/* später avatarId, aktuell undefined lassen */);

  // für Shopify: ?shop=domain kommt von der Theme Extension
  const shopDomain = searchParams?.shop ?? "local-dev";

  const dynamicVariables = {
    name: "EFRO",
    language: "de",
    userName: "Evren",
    shopDomain,
  };

  // 🔹 Chat-Messages State (für Explanation-Guards)
  const [chatMessages, setChatMessages] = useState<
    { id: string; text: string; sender: "user" | "efro" }[]
  >([]);

  // 🔹 Produkt- und SellerBrain-State
  const [allProducts, setAllProducts] = useState<EfroProduct[]>([]);
  // Ref für synchronen Zugriff auf Produkte (verhindert Race Conditions)
  const allProductsRef = useRef<EfroProduct[]>([]);
  const [sellerIntent, setSellerIntent] =
    useState<ShoppingIntent>("quick_buy");
  const [sellerReplyText, setSellerReplyText] = useState("");
  const [sellerRecommended, setSellerRecommended] = useState<EfroProduct[]>(
    []
  );

  // Komplettes SellerBrain-Result für Panel
  const [sellerResult, setSellerResult] = useState<SellerBrainResult | null>(
    null
  );

  // Letztes "normales" Produkt-Result für Kontext bei Erklärfragen
  const [lastProductResult, setLastProductResult] =
    useState<SellerBrainResult | null>(null);

  // Letzte Empfehlungen für Erklärung/Preis
  const [lastRecommendations, setLastRecommendations] = useState<EfroProduct[]>(
    []
  );
  const [lastRecommendedProducts, setLastRecommendedProducts] = useState<
    EfroProduct[]
  >([]);

  // 🔹 Plan-State (starter / pro / enterprise)
  const [shopPlan, setShopPlan] = useState<string>("starter");

  // 🔹 SellerBrain-Kontext (z. B. aktive Kategorie)
  const [sellerContext, setSellerContext] = useState<{
    activeCategorySlug?: string | null;
  }>({});

  /* ===========================================================
      SPRECH-HANDLER VON AVATAR
  ============================================================ */

  const speakHandlerRef = useRef<((text: string) => void) | null>(null);

  function registerSpeakHandler(fn: ((text: string) => void) | null) {
    speakHandlerRef.current = fn;
  }

  function speak(text: string) {
    if (!speakHandlerRef.current) {
      console.log(
        "[EFRO Speak] Kein aktiver Handler – Text wird nur im Chat angezeigt:",
        text
      );
      return;
    }
    speakHandlerRef.current(text);
  }

  /* ===========================================================
      KATALOG-DEBUG-FUNKTION
  ============================================================ */

  const debugCatalogOverview = useCallback((products: EfroProduct[]) => {
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

    // NEU: Keyword-Analyse
    const stats = analyzeCatalogKeywords(products);
    console.log("[EFRO Catalog Keywords]", {
      totalProducts: stats.totalProducts,
      topKeywords: stats.keywords.slice(0, 30),
    });
  }, []);

  /* ===========================================================
      PRODUKTE LADEN (Shopify → EfroProduct, Fallback mockCatalog)
  ============================================================ */

  const fetchProducts = useCallback(async () => {
    try {
      // 1) Primär: Shopify-Admin-Route
      const res = await fetch(`/api/shopify-products`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();

      const shopifyProducts: ShopifyProduct[] = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
        ? data
        : [];

      if (!shopifyProducts.length) {
        throw new Error("Keine Shopify-Produkte im Response");
      }

      let products = mapShopifyToEfro(shopifyProducts);

      // Optionale Test-Produkte für Attribut-Engine hinzufügen
      const enableAttributeDemo =
        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
        shopDomain === "local-dev";

      if (enableAttributeDemo) {
        products = [...products, ...efroAttributeTestProducts];
      }

      const sources = Array.from(
        new Set(
          products.map((p) => (p as any).source || "shopify-admin")
        )
      );

      console.log("[EFRO AllProducts]", {
        count: products.length,
        shopDomain,
        sources,
        sample: products.slice(0, 10).map((p) => p.title),
      });

      setAllProducts(products);
      allProductsRef.current = products; // Ref synchron aktualisieren
      debugCatalogOverview(products);
    } catch (err) {
      console.error(
        "[EFRO AllProducts] Shopify-Route fehlgeschlagen, Fallback auf mockCatalog",
        err
      );

      let products = mockCatalog;

      // Optionale Test-Produkte für Attribut-Engine hinzufügen
      const enableAttributeDemo =
        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
        shopDomain === "local-dev";

      if (enableAttributeDemo) {
        products = [...products, ...efroAttributeTestProducts];
      }

      const sources = Array.from(
        new Set(
          products.map((p) => (p as any).source || "mockCatalog")
        )
      );

      console.log("[EFRO AllProducts]", {
        count: products.length,
        shopDomain,
        sources,
        sample: products.slice(0, 10).map((p) => p.title),
      });

      setAllProducts(products);
      allProductsRef.current = products; // Ref synchron aktualisieren
      debugCatalogOverview(products);
    }
  }, [debugCatalogOverview]);

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
      HILFSFUNKTIONEN FÜR FRAGETYPEN
  ============================================================ */

  function isPriceQuestion(text: string): boolean {
    const t = text.toLowerCase();
    return (
      t.includes("preis") ||
      t.includes("kosten") ||
      t.includes("wie teuer") ||
      t.includes("wie viel kostet") ||
      t.includes("wieviel kostet") ||
      t === "preis?" ||
      t === "preis" ||
      t.includes("how much") ||
      t.includes("price")
    );
  }

  function isIngredientsQuestion(text: string): boolean {
    const t = text.toLowerCase();
    return (
      t.includes("inhaltsstoff") ||
      t.includes("inhaltsstoffe") ||
      t.includes("ingredients") ||
      t.includes("inci")
    );
  }

  function extractIngredientsSnippet(description: string): string {
    const desc = description.trim();
    if (!desc) return "";

    const lower = desc.toLowerCase();
    const indices = [
      lower.indexOf("inhaltsstoffe"),
      lower.indexOf("ingredients"),
      lower.indexOf("inci"),
    ].filter((i) => i >= 0);

    const ingredientsIndex = indices.length ? Math.min(...indices) : -1;

    if (ingredientsIndex === -1) {
      return desc.length > 200 ? desc.slice(0, 200) + "…" : desc;
    }

    const snippet = desc.slice(ingredientsIndex, ingredientsIndex + 300);
    return snippet.length < desc.length - ingredientsIndex
      ? snippet + "…"
      : snippet;
  }

  function formatPrice(price?: number | null): string {
    if (price == null) return "Preis auf Anfrage";
    return `${price.toFixed(2).replace(".", ",")} €`;
  }

  function detectExplanationType(
    text: string
  ): "ingredients" | "usage" | "washing" | "price" | null {
    const t = text.toLowerCase();

    const isIngredientQuestion =
      t.includes("inhaltsstoff") ||
      t.includes("inhaltsstoffe") ||
      t.includes("ingredient") ||
      t.includes("ingredients") ||
      t.includes("inci");

    const isUsageQuestion =
      t.includes("wie verwende ich") ||
      t.includes("wie benutze ich") ||
      t.includes("anwendung") ||
      t.includes("apply") ||
      t.includes("usage") ||
      t.includes("verwenden") ||
      t.includes("verwende") ||
      t.includes("benutzen") ||
      t.includes("für was darf ich") ||
      t.includes("für was kann ich") ||
      t.includes("wofür kann ich") ||
      t.includes("wofür darf ich") ||
      t.includes("geeignet für") ||
      (t.includes("ist es für") && t.includes("haut"));

    const isWashingQuestion =
      t.includes("waschen") ||
      t.includes("wasche") ||
      t.includes("pflegehinweis") ||
      t.includes("pflege") ||
      t.includes("wash") ||
      t.includes("washing");

    const isPrice = isPriceQuestion(t);

    if (isIngredientQuestion) return "ingredients";
    if (isUsageQuestion) return "usage";
    if (isWashingQuestion) return "washing";
    if (isPrice) return "price";
    return null;
  }

  function findBestProductMatchByText(
    text: string,
    products: EfroProduct[]
  ): EfroProduct | null {
    const t = text.toLowerCase();
    const words = t
      .split(/[^a-z0-9äöüß]+/i)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3);

    if (words.length === 0 || products.length === 0) return null;

    const strong = words.filter((w) => w.length >= 4);

    let best: EfroProduct | null = null;
    let bestScore = 0;

    for (const p of products) {
      const blob =
        `${(p.title || "")} ${(p.description || "")} ` +
        `${Array.isArray((p as any).tags) ? (p as any).tags.join(" ") : ""}`.toLowerCase();

      let score = 0;

      for (const w of words) {
        if (!w) continue;
        if (blob.includes(w)) score += 2;
      }

      for (const w of strong) {
        if (blob.includes(w)) score += 3;
      }

      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }

    if (bestScore === 0) return null;
    return best;
  }

  /* ===========================================================
      DIREKTE ANTWORTEN (OHNE SELLERBRAIN)
  ============================================================ */

  function sendDirectAiReply(reply: string, options?: { speak?: boolean }) {
    setChatMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: reply,
        sender: "efro",
      },
    ]);
    setSellerReplyText(reply);

    if (options?.speak) {
      speak(reply);
    }
  }

  /* ===========================================================
      SELLERBRAIN-BRIDGE (wird vom Avatar aufgerufen)
  ============================================================ */

  const createRecommendations = useCallback(
    (userText: string) => {
      // Verwende Ref für synchronen Zugriff (verhindert Race Conditions)
      const sellerProducts = allProductsRef.current;
      
      if (!sellerProducts.length) {
        console.log(
          "[EFRO SellerBrain] Kein Katalog geladen, Empfehlung übersprungen.",
          { allProductsStateLength: allProducts.length, allProductsRefLength: sellerProducts.length }
        );
        return;
      }

      const cleanedText = userText.trim();
      if (!cleanedText) return;

      const explanation = detectExplanationType(cleanedText);

      // Off-Topic-Check
      const offTopicKeywords = [
        "politik",
        "wahl",
        "cursor",
        "freund",
        "freunde",
        "gefühle",
        "lebenssituation",
      ];
      const isOffTopic = offTopicKeywords.some((keyword) =>
        cleanedText.toLowerCase().includes(keyword)
      );

      if (isOffTopic) {
        sendDirectAiReply(
          "Ich bin hier, um dir bei Produkten aus dem Shop zu helfen. Frag mich einfach nach einem Produkt, z. B. 'Zeige mir Duschgel'.",
          { speak: true }
        );
        console.log("[EFRO OffTopic] Redirecting to product questions", {
          text: cleanedText,
        });
        return;
      }

      // ---------- Inhaltsstoffe ----------
      if (explanation === "ingredients" || isIngredientsQuestion(cleanedText)) {
        let fromLast =
          lastRecommendedProducts[0] || lastRecommendations[0] || null;
        let fromSeller = sellerRecommended[0] || null;
        let primary: EfroProduct | null = fromLast || fromSeller;

        // Wenn noch kein Produkt im Kontext ist: direkt aus dem Text matchen
        if (!primary) {
          primary = findBestProductMatchByText(cleanedText, sellerProducts);
        }

        const contextFromRef = fromLast
          ? 1
          : fromSeller
          ? 2
          : primary
          ? 3 // 3 = direkt aus Text gematcht
          : 0;

        console.log("[EFRO IngredientsExplanation]", {
          text: cleanedText,
          primaryTitle: primary?.title,
          contextFromRef,
        });

        if (!primary) {
          sendDirectAiReply(
            "Zu diesem Produkt habe ich hier keine Inhaltsstoffe hinterlegt. Klicke im Shop auf das Produkt, dort findest du alle Details.",
            { speak: true }
          );
          return;
        }

        const desc = (primary.description || "").trim();
        const hasIngredients =
          desc.toLowerCase().includes("inhaltsstoffe") ||
          desc.toLowerCase().includes("ingredients") ||
          desc.toLowerCase().includes("inci");

        if (hasIngredients) {
          const shortInfo = extractIngredientsSnippet(desc);
          sendDirectAiReply(
            `Zu diesem Produkt habe ich folgende Infos zu den Inhaltsstoffen: ${shortInfo}`,
            { speak: true }
          );
        } else {
          sendDirectAiReply(
            "Zu diesem Produkt habe ich hier keine Inhaltsstoffe hinterlegt. Klicke im Shop auf das Produkt, dort findest du alle Details.",
            { speak: true }
          );
        }
        return;
      }

      // ---------- Anwendung / Waschen ----------
      if (explanation === "usage" || explanation === "washing") {
        const t = cleanedText.toLowerCase();
        let reply = "";

        if (explanation === "usage") {
          if (
            t.includes("trockene haut") ||
            t.includes("trockener haut") ||
            t.includes("sensible haut") ||
            t.includes("empfindliche haut")
          ) {
            reply =
              "Ob ein Duschgel speziell für trockene oder empfindliche Haut geeignet ist, erfährst du am besten in der Produktbeschreibung oder auf der Verpackung. Schau dir die Produktseite im Shop an – dort findest du Hinweise zum Hauttyp und zur Verträglichkeit.";
          } else {
            reply =
              "Die genaue Anwendung hängt vom jeweiligen Produkt ab. Auf der Produktseite im Shop findest du alle wichtigen Anwendungshinweise.";
          }
        } else if (explanation === "washing") {
          reply =
            "Wasch- und Pflegehinweise findest du am besten direkt auf der Produktseite im Shop oder auf dem Pflegeetikett.";
        }

        sendDirectAiReply(reply, { speak: true });

        console.log("[EFRO ExplanationGuard] Skipping sellerBrain", {
          text: cleanedText,
          explanation,
        });

        return;
      }

      // ---------- Preis ----------
      if (explanation === "price" || isPriceQuestion(cleanedText)) {
        const fromLast =
          lastRecommendedProducts[0] || lastRecommendations[0] || null;
        const fromSeller = sellerRecommended[0] || null;
        const primary = fromLast || fromSeller;
        const contextFromRef = fromLast ? 1 : fromSeller ? 2 : 0;

        console.log("[EFRO PriceExplanation]", {
          text: cleanedText,
          primaryTitle: primary?.title,
          primaryPrice: primary?.price,
          contextFromRef,
        });

        if (!primary) {
          sendDirectAiReply(
            "Ich habe gerade kein konkretes Produkt im Fokus. Klicke auf eine Produktkarte, dort siehst du den exakten Preis.",
            { speak: true }
          );
          return;
        }

        const formattedPrice = formatPrice(primary.price);
        const name = primary.title || "dieses Produkt";

        sendDirectAiReply(`Das ${name} kostet aktuell ${formattedPrice}.`, {
          speak: true,
        });
        return;
      }

      // ---------- Normale Produktanfrage → SellerBrain ----------
      try {
        const result: SellerBrainResult = runSellerBrain(
          cleanedText,
          sellerIntent,
          sellerProducts,
          shopPlan,
          sellerRecommended,
          sellerContext.activeCategorySlug
            ? { activeCategorySlug: sellerContext.activeCategorySlug }
            : undefined
        );

        const recommendations = result.recommended ?? [];

        console.log("[EFRO SellerBrain]", {
          userText: cleanedText,
          intent: result.intent,
          plan: shopPlan,
          recCount: recommendations.length,
          usedSourceCount: sellerProducts.length,
          hasKeywordInCatalog: recommendations.length > 0,
        });

        // EFRO Event Logging: Erfolgreicher SellerBrain-Call (fire-and-forget)
        fetch("/api/efro/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopDomain: "local-dev",
            userText: cleanedText,
            intent: result.intent,
            productCount: recommendations.length,
            plan: shopPlan ?? "starter",
            hadError: false,
            errorMessage: null,
          }),
          keepalive: true, // hilft, wenn der Tab kurz danach geschlossen wird
        }).catch((err) => {
          // Fehler nur loggen, UI darf nicht blockiert werden
          console.error("[EFRO Event Logging] Fetch failed", err);
        });

        console.log("[EFRO UI Result]", {
          intent: result.intent,
          productCount: recommendations.length,
          titles: recommendations.slice(0, 5).map((p) => p.title),
        });

        console.log("[EFRO UI PRODUCTS]", {
          text: cleanedText,
          intent: result.intent,
          productCount: recommendations.length,
          titles: recommendations.map((p) => p.title),
          categories: recommendations.map((p) => p.category),
        });

        // letzte Empfehlungen merken
        setLastRecommendedProducts(recommendations);
        setLastRecommendations(recommendations);

        setSellerResult(result);
        setLastProductResult(result);

        setSellerIntent(result.intent);
        setSellerReplyText(result.replyText);
        setSellerRecommended(recommendations);

        // Kontext aus SellerBrain-Ergebnis aktualisieren
        const nextContext = result.nextContext;
        if (nextContext) {
          setSellerContext((prev) => ({
            ...prev,
            ...nextContext,
          }));
          console.log("[EFRO Client] Updated sellerContext", nextContext);
        }
      } catch (err: any) {
        console.error("[EFRO SellerBrain Error]", err);

        // EFRO Event Logging: Fehlerfall
        void logEfroEvent({
          shopDomain: shopDomain || "local-dev",
          userText: cleanedText,
          intent: "error",
          productCount: 0,
          plan: shopPlan ?? null,
          hadError: true,
          errorMessage: err?.message ? String(err.message) : "Unknown SellerBrain error",
        });

        // Fallback: Leere Empfehlungen setzen, damit UI nicht crasht
        setSellerResult(null);
        setSellerRecommended([]);
        setSellerReplyText("Entschuldigung, es gab einen Fehler bei der Produktsuche.");
      }
    },
    [
      allProducts,
      sellerIntent,
      shopPlan,
      sellerRecommended,
      lastRecommendedProducts,
      lastRecommendations,
    ]
  );

  /* ===========================================================
      RENDER
  ============================================================ */

  return (
    <main className="w-full h-screen bg-[#FFF8F0] relative overflow-hidden">
      {/* AVATAR + VOICE + CHAT */}
      <AvatarPreview
        src={mascotUrl}
        className="w-full h-full"
      >
        <ElevenLabsAvatar
          dynamicVariables={dynamicVariables}
          createRecommendations={createRecommendations}
          setChatMessages={setChatMessages}
          registerSpeakHandler={registerSpeakHandler}
        />
      </AvatarPreview>

        {/* PRODUKT-PANEL */}
        <EfroProductPanel
          visible={
            !!sellerResult &&
            sellerResult.recommended !== undefined &&
            sellerResult.recommended.length > 0
          }
          products={sellerResult?.recommended ?? []}
          replyText={sellerResult?.replyText ?? sellerReplyText}
        />
    </main>
  );
}
