"use client";

import { logEfroEvent } from "@/lib/efro/logEventClient";
import { getRandomDemoPhrase } from "@/lib/voices/demoPhrases";

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
import { AvatarPreview } from "@/components/efro/AvatarPreview";

import EFROChatWindow from "@/components/EFROChatWindow";
import { EfroProductPanel } from "@/components/EfroProductPanel";
import {
  EfroProduct,
  ShoppingIntent,
  mockCatalog,
} from "@/lib/products/mockCatalog";
import { efroAttributeTestProducts } from "@/lib/catalog/efro-attribute-test-products";
import type { LoadProductsResult } from "@/lib/products/efroProductLoader";
import {
  runSellerBrain,
  runSellerBrainV2,
  SellerBrainResult,
  type SellerBrainContext,
  type SellerBrainV2Result,
  type RunSellerBrainV2Options,
} from "@/lib/sales/sellerBrain";
import { analyzeCatalogKeywords } from "@/lib/sales/catalogKeywordAnalyzer";
import { buildMascotUrl, type EfroAvatarId } from "@/lib/efro/mascotConfig";
import { SHOW_ME_PATTERNS } from "@/lib/sales/languageRules.de";
import { normalizeUserInput } from "@/lib/sales/modules/utils";


/* ===========================================================
   SHOPIFY → EFRO MAPPING
=========================================================== */

type ShopSettings = {
  shop: string;
  avatar_id: string | null;
  voice_id: string | null;
  locale: string | null;
  tts_enabled: boolean | null;
};





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

  // EFRO VOICE+CHAT FIX 2025-12-10: Zentrale User-Input-Handlung
  handleUserTextInput?: (text: string) => void;

  // Handler-Registrierung, damit Home EFRO sprechen lassen kann
  registerSpeakHandler?: (fn: ((text: string) => void) | null) => void;
  registerStartHandler?: (fn: (() => void) | null) => void;
  registerStopHandler?: (fn: (() => void) | null) => void;
}

function ElevenLabsAvatar({
  dynamicVariables,
  createRecommendations,
  setChatMessages: externalSetChatMessages,
  handleUserTextInput,
  registerSpeakHandler,
  registerStartHandler,
  registerStopHandler,
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
  const [voiceError, setVoiceError] = useState<string | null>(null);

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

      // Professioneller Intro-Text beim Start der Session
      const introText = getRandomDemoPhrase("intro");
      console.log("[EFRO DemoIntro] Sending intro text", {
        text: introText.substring(0, 50) + "...",
      });

      // Kurz warten, damit die Session stabil ist, dann Intro senden
      setTimeout(() => {
        const fn = (conversation as any)?.sendUserMessage;
        if (typeof fn === "function") {
          const phrase = `Bitte sprich genau folgenden Satz und füge nichts hinzu: "${introText}"`;
          try {
            const maybePromise = fn(phrase);
            if (maybePromise && typeof (maybePromise as any).then === "function") {
              maybePromise.catch((err: any) => {
                console.error("[EFRO DemoIntro] Error sending intro", err);
              });
            }
          } catch (err) {
            console.error("[EFRO DemoIntro] Error sending intro", err);
          }
        } else {
          console.warn("[EFRO DemoIntro] sendUserMessage nicht verfügbar");
        }
      }, 500);
    },

    onDisconnect: () => {
      console.log("ElevenLabs Disconnected");
      setDebugStatus("disconnected");
    },

    onError: (error: any) => {
      console.error("ElevenLabs Error:", error);
      setDebugStatus("error");

      // Fehlerbehandlung für Voice-Fehler
      const errorMessage = error?.message || String(error);
      const errorReason = error?.reason || "";
      
      if (
        errorMessage.includes("Could not get signed URL") ||
        errorReason.includes("Could not get signed URL") ||
        (error as any)?.type === "close" &&
        (errorReason.includes("ElevenLabs connection error") ||
          errorMessage.includes("ElevenLabs connection error"))
      ) {
        setVoiceError(
          "Voice mode ist aktuell nicht verfügbar. Bitte später erneut versuchen."
        );
      }
    },

    /* ===========================================================
        INCOMING MESSAGES (VOICE + EFRO)
    ============================================================ */
    onMessage: (msg: any) => {
      // RAW-IN: Alle eingehenden ElevenLabs-Nachrichten (für Debug)
      // WICHTIG: Nur Nachrichten mit source: "user" werden als EFRO-Chat-Nachricht verwendet.
      // Nachrichten mit source: "ai" / "assistant" werden ignoriert (siehe unten).
      console.log("RAW-IN:", {
        ...msg,
        _note: "ElevenLabs-Raw-Message. Nur source: 'user' wird als EFRO-Chat-Nachricht verwendet.",
      });

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
         USER VOICE → zentrale handleUserTextInput-Pipeline
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

        console.log("[EFRO Voice] USER message detected", { text: cleanText });

        // EFRO VOICE+CHAT FIX 2025-12-10: Zentrale handleUserTextInput-Pipeline
        if (typeof handleUserTextInput === "function") {
          handleUserTextInput(cleanText);
        } else if (typeof createRecommendations === "function") {
          // Fallback für alte Implementierung
          console.warn("[EFRO Voice] handleUserTextInput nicht gesetzt, verwende createRecommendations");
          createRecommendations(cleanText);
        } else {
          console.log(
            "[EFRO Voice] handleUserTextInput und createRecommendations nicht gesetzt – Katalog-Logik wird übersprungen."
          );
        }

        return;
      }

      /* ===========================================================
         EFRO (Assistant) → nur für LipSync, NICHT als Chat-Nachricht
      ============================================================ */
      if (isAssistantMessage) {
        console.log("[ElevenLabs AI ignored]", { 
          message: cleanText,
          source: msg.source || msg.role || "unknown",
          note: "Diese ElevenLabs-Agent-Nachricht wird NICHT als EFRO-Chat-Nachricht angezeigt. Nur SellerBrain-Reply-Text wird im EFRO-Chat verwendet."
        });
        // keine Chat-Nachricht, keine Recommendations
        // WICHTIG: ElevenLabs-Agent-Antworten (source: "ai" / "assistant") werden
        // NICHT in den EFRO-Chat übernommen. Nur SellerBrain.replyText wird als
        // EFRO-Antwort im Chat angezeigt.
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
      SIGNED URL (aligned with Mascot demo)
  ============================================================ */

  const getSignedUrl = async (): Promise<string> => {
    const response = await fetch("/api/get-signed-url-seller", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        dynamicVariables: dynamicVariables || {},
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Failed to get signed url: ${response.statusText}`);
    }
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
      setVoiceError(null);
      setDebugStatus("connecting");
      connectionStartTime.current = Date.now();

      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signedUrl = cachedUrl || (await getSignedUrl());

      await conversation.startSession({
        signedUrl,
        dynamicVariables,
      });

      setDebugStatus("connected");
    } catch (error: any) {
      console.error("Start error:", error);
      setIsConnecting(false);
      setDebugStatus("error");

      // Fehlerbehandlung für Voice-Fehler
      const errorMessage = error?.message || String(error);
      const errorReason = error?.reason || "";
      
      if (
        errorMessage.includes("Could not get signed URL") ||
        errorReason.includes("Could not get signed URL") ||
        (error as any)?.type === "close" &&
        (errorReason.includes("ElevenLabs connection error") ||
          errorMessage.includes("ElevenLabs connection error"))
      ) {
        setVoiceError(
          "Voice mode ist aktuell nicht verfügbar. Bitte später erneut versuchen."
        );
      }
    }
  }, [conversation, cachedUrl, dynamicVariables]);

  useEffect(() => {
    if (!registerStartHandler) return;
    registerStartHandler(startConversation);
    return () => registerStartHandler(null);
  }, [registerStartHandler, startConversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    setDebugStatus("disconnected");
  }, [conversation]);

  useEffect(() => {
    if (!registerStopHandler) return;
    registerStopHandler(stopConversation);
    return () => registerStopHandler(null);
  }, [registerStopHandler, stopConversation]);

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

  // 🔚 ElevenLabsAvatar rendert nichts Sichtbares – kümmert sich nur um Voice + SellerBrain-Brücke
  return null;
} // <-- schließt die Funktion ElevenLabsAvatar sauber

  
  

/* ===========================================================
   HOME WRAPPER (mit Shopify shop Param)
=========================================================== */

type HomeProps = {
  searchParams?: {
    shop?: string;
  };
};

export default function Home({ searchParams }: HomeProps) {
  // 1) Shop-Domain aus Query, Fallback "demo"
  const shopDomain = searchParams?.shop ?? "demo";

  // 2) Shop-Settings State (Avatar, Stimme, Locale, TTS)
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);

  // 3) Settings laden (GET /api/efro/shop-settings?shop=...)
  useEffect(() => {
    let cancelled = false;

    async function loadShopSettings() {
      try {
        setSettingsLoading(true);
        const res = await fetch(
          `/api/efro/shop-settings?shop=${encodeURIComponent(shopDomain)}`,
          { cache: "no-store" }
        );

        if (!res.ok) {
          console.warn("[EFRO ShopSettings] HTTP error", res.status);
          if (!cancelled) setShopSettings(null);
          return;
        }

        const data = await res.json();
        const settings: ShopSettings | null = data?.settings ?? null;

        if (!cancelled) {
          setShopSettings(settings);
        }

        console.log("[EFRO ShopSettings] loaded", {
          shopDomain,
          settings,
        });
      } catch (err) {
        console.error("[EFRO ShopSettings] fetch error", err);
        if (!cancelled) {
          setShopSettings(null);
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    loadShopSettings();

    return () => {
      cancelled = true;
    };
  }, [shopDomain]);

  // 4) Effektiven Avatar bestimmen (Fallback retroBot)
  const effectiveAvatarId: EfroAvatarId =
    (shopSettings?.avatar_id as EfroAvatarId) ?? "retroBot";

  // 5) Mascot-URL aus Avatar-ID berechnen
  const mascotUrl = buildMascotUrl(effectiveAvatarId);

  // 6) Sprache aus Settings ableiten (Fallback de)
  const effectiveLocale = shopSettings?.locale || "de";

  // 7) Dynamic Variables für ElevenLabs/Mascot
  // avatarId wird an API-Route übergeben (Fallback, falls Shop-Settings nicht geladen werden können)
  const dynamicVariables = {
    name: "EFRO",
    language: effectiveLocale,
    userName: "Evren",
    shopDomain,
    avatarId: effectiveAvatarId, // Wird von API-Route verwendet, falls Shop-Settings fehlen
  };

  // 🔹 Chat-Messages State (für Explanation-Guards)
  const [chatMessages, setChatMessages] = useState<
    { id: string; text: string; sender: "user" | "efro" }[]
  >([]);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Helper-Funktion für Chat-Messages mit Logging
  const appendChatMessage = useCallback((msg: {
    id: string;
    text: string;
    sender: "user" | "efro";
  }) => {
    setChatMessages((prev) => {
      const next = [...prev, msg];
      console.log("[EFRO Chat] append", {
        msg,
        countBefore: prev.length,
        countAfter: next.length,
      });
      return next;
    });
  }, []);

  // Helper-Funktionen für SellerBrain v2 (Shop-Domain & Locale)
  function resolveShopDomain(): string {
    return shopDomain || "demo";
  }

  function resolveLocale(): string {
    return "de";
  }

  // 🔹 Produkt- und SellerBrain-State
  const [allProducts, setAllProducts] = useState<EfroProduct[]>([]);
  const allProductsRef = useRef<EfroProduct[]>([]);
  const [sellerIntent, setSellerIntent] =
    useState<ShoppingIntent>("quick_buy");
  const [sellerReplyText, setSellerReplyText] = useState("");
  const [sellerRecommended, setSellerRecommended] = useState<EfroProduct[]>(
    []
  );
  const [sellerResult, setSellerResult] = useState<SellerBrainResult | null>(
    null
  );
  const [lastProductResult, setLastProductResult] =
    useState<SellerBrainResult | null>(null);
  const [lastRecommendations, setLastRecommendations] = useState<EfroProduct[]>(
    []
  );
  const [lastRecommendedProducts, setLastRecommendedProducts] = useState<
    EfroProduct[]
  >([]);

  // 🔹 Plan-State (starter / pro / enterprise)
  const [shopPlan, setShopPlan] = useState<string>("starter");

  // 🔹 SellerBrain-Kontext
  const [sellerContext, setSellerContext] = useState<SellerBrainContext>({});

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

  const startHandlerRef = useRef<(() => void) | null>(null);

  function registerStartHandler(fn: (() => void) | null) {
    startHandlerRef.current = fn;
  }

  function startVoiceSession() {
    if (!startHandlerRef.current) {
      console.warn("[EFRO Voice] Kein startHandler registriert – Session kann nicht gestartet werden");
      return;
    }
    try {
      startHandlerRef.current();
    } catch (err) {
      console.error("[EFRO Voice] Fehler beim Starten der Session", err);
    }
  }

  const [isVoiceActive, setIsVoiceActive] = useState(false);

  const stopHandlerRef = useRef<(() => void) | null>(null);

  function registerStopHandler(fn: (() => void) | null) {
    stopHandlerRef.current = fn;
  }

  function stopVoiceSession() {
    if (!stopHandlerRef.current) {
      console.warn("[EFRO Voice] Kein stopHandler registriert – Session kann nicht beendet werden");
      return;
    }
    try {
      stopHandlerRef.current();
    } catch (err) {
      console.error("[EFRO Voice] Fehler beim Stoppen der Session", err);
    }
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

    const stats = analyzeCatalogKeywords(products);
    console.log("[EFRO Catalog Keywords]", {
      totalProducts: stats.totalProducts,
      topKeywords: stats.keywords.slice(0, 30),
    });
  }, []);

  /* ===========================================================
      PRODUKTE LADEN
  ============================================================ */

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/efro/products?shop=${encodeURIComponent(shopDomain)}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to load products`);
      }

      const result: LoadProductsResult = await res.json();

      if (result.success === true) {
        console.log("[EFRO AllProducts]", {
          count: result.products.length,
          shopDomain,
          source: result.source,
          sample: result.products.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            category: p.category,
          })),
        });

        if (result.error) {
          console.warn("[EFRO AllProducts] API reported error but success=true", {
            shopDomain,
            source: result.source,
            error: result.error,
          });
        }

        setAllProducts(result.products);
        allProductsRef.current = result.products;
        debugCatalogOverview(result.products);
      } else {
        console.error(
          "[EFRO AllProducts] API returned success=false, Fallback auf mockCatalog",
          {
            shopDomain,
            source: result.source,
            error: result.error,
          }
        );

        let products = mockCatalog;

        const enableAttributeDemo =
          process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
          shopDomain === "local-dev";

        if (enableAttributeDemo) {
          products = [...products, ...efroAttributeTestProducts];
        }

        console.log("[EFRO AllProducts] Using mockCatalog fallback", {
          count: products.length,
          shopDomain,
        });

        setAllProducts(products);
        allProductsRef.current = products;
        debugCatalogOverview(products);
      }
    } catch (err) {
      console.error(
        "[EFRO AllProducts] Fehler beim Laden der Produkte, Fallback auf mockCatalog",
        err
      );

      let products = mockCatalog;

      const enableAttributeDemo =
        process.env.NEXT_PUBLIC_EFRO_ATTRIBUTE_DEMO === "1" &&
        shopDomain === "local-dev";

      if (enableAttributeDemo) {
        products = [...products, ...efroAttributeTestProducts];
      }

      console.log("[EFRO AllProducts] Using mockCatalog fallback", {
        count: products.length,
        shopDomain,
      });

      setAllProducts(products);
      allProductsRef.current = products;
      debugCatalogOverview(products);
    }
  }, [shopDomain, debugCatalogOverview]);

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
    appendChatMessage({
      id: `efro-direct-${Date.now()}`,
      text: reply,
      sender: "efro",
    });
    setSellerReplyText(reply);

    if (options?.speak) {
      speak(reply);
    }
  }

  /* ===========================================================
      TEXT-NORMALISIERUNG FÜR SELLERBRAIN
  ============================================================ */

  function normalizeSellerBrainText(rawText: string): string {
    const text = normalizeUserInput(rawText ?? "");
    if (!text) return text;

    // Satzaufteilung
    const sentences = text
      .split(/[\.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Triggerliste aufbauen
    const EXTRA_TRIGGERS = [
      "ich suche",
      "hast du",
      "brauch",
      "brauche",
      "kannst du mir",
    ];

    const PATTERNS = [
      ...SHOW_ME_PATTERNS,
      ...EXTRA_TRIGGERS,
    ].map((p) => p.toLowerCase());

    // Suche nach dem relevanten Satz (von hinten nach vorne)
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentence = sentences[i];
      const sLower = sentence.toLowerCase();

      if (PATTERNS.some((p) => sLower.includes(p))) {
        return sentence.trim();
      }
    }

    // Fallback: Wenn kein Satz einen Trigger enthält
    if (sentences.length >= 1) {
      // Nimm die letzten 1-2 Sätze
      const lastSentences = sentences.slice(-2);
      return lastSentences.join(". ");
    }

    // Wenn es keine sinnvollen Sätze gibt (nur ein langer String ohne Punkt)
    const MAX_LEN = 180;
    return text.length > MAX_LEN ? text.slice(text.length - MAX_LEN) : text;
  }

  /* ===========================================================
      SELLERBRAIN-BRIDGE (wird vom Avatar aufgerufen)
  ============================================================ */

const createRecommendations = useCallback(
  async (userText: string) => {
    const originalText = userText ?? "";
    const normalizedText = normalizeUserInput(originalText);

    const sellerProducts = allProductsRef.current;

    if (!sellerProducts.length) {
      console.log(
        "[EFRO SellerBrain] Kein Katalog geladen, Empfehlung übersprungen.",
        {
          allProductsStateLength: allProducts.length,
          allProductsRefLength: sellerProducts.length,
        }
      );
      return;
    }

    const rawCleaned = userText.trim();
    if (!rawCleaned) return;

    const normalizedForSellerBrain = normalizeSellerBrainText(rawCleaned);

    if (!normalizedForSellerBrain) {
      console.log(
        "[EFRO Pipeline] normalizeSellerBrainText returned empty – aborting",
        { rawCleaned }
      );
      return;
    }

    // Alias, damit alle älteren Stellen mit `cleanedText` weiter funktionieren
    const cleanedText = normalizedForSellerBrain;
    const cleanedTextLower = cleanedText.toLowerCase();

    console.log("[EFRO Pipeline] sellerBrainText", {
      raw: rawCleaned,
      normalized: normalizedForSellerBrain,
    });

    const explanation = detectExplanationType(normalizedForSellerBrain);

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
      cleanedTextLower.includes(keyword)
    );

    if (isOffTopic) {
      sendDirectAiReply(
        "Ich bin hier, um dir bei Produkten aus dem Shop zu helfen. Frag mich einfach nach einem Produkt, z. B. 'Zeige mir Duschgel'.",
        { speak: true }
      );
      console.log("[EFRO OffTopic] Redirecting to product questions", {
        text: normalizedForSellerBrain,
      });
      return;
    }

    // Ingredients
    if (
      explanation === "ingredients" ||
      isIngredientsQuestion(normalizedForSellerBrain)
    ) {
      let fromLast =
        lastRecommendedProducts[0] || lastRecommendations[0] || null;
      let fromSeller = sellerRecommended[0] || null;
      let primary: EfroProduct | null = fromLast || fromSeller;

      if (!primary) {
        primary = findBestProductMatchByText(
          normalizedForSellerBrain,
          sellerProducts
        );
      }

      const contextFromRef = fromLast
        ? 1
        : fromSeller
        ? 2
        : primary
        ? 3
        : 0;

      console.log("[EFRO IngredientsExplanation]", {
        text: normalizedForSellerBrain,
        primaryTitle: primary?.title,
        contextFromRef,
      });

      if (!primary) {
        sendDirectAiReply(
          "Zu diesem Produkt habe ich hier keine Inhaltsstoffe hinterlegt. Schau dir bitte die Produktseite im Shop an – dort findest du alle Details.",
          { speak: true }
        );
        return;
      }

      const desc = (primary.description || "").trim();
      const descLower = desc.toLowerCase();
      const hasIngredients =
        descLower.includes("inhaltsstoffe") ||
        descLower.includes("ingredients") ||
        descLower.includes("inci");

      if (hasIngredients) {
        const shortInfo = extractIngredientsSnippet(desc);
        sendDirectAiReply(
          `Zu diesem Produkt habe ich folgende Infos zu den Inhaltsstoffen: ${shortInfo}`,
          { speak: true }
        );
      } else {
        sendDirectAiReply(
          "Zu diesem Produkt habe ich hier keine Inhaltsstoffe hinterlegt. Schau dir bitte die Produktseite im Shop an – dort findest du alle Details.",
          { speak: true }
        );
      }
      return;
    }

    // Anwendung / Waschen
    if (explanation === "usage" || explanation === "washing") {
      const t = cleanedTextLower;
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
        text: normalizedForSellerBrain,
        explanation,
      });

      return;
    }

    // Preis
    if (explanation === "price" || isPriceQuestion(normalizedForSellerBrain)) {
      const fromLast =
        lastRecommendedProducts[0] || lastRecommendations[0] || null;
      const fromSeller = sellerRecommended[0] || null;
      const primary = fromLast || fromSeller;
      const contextFromRef = fromLast ? 1 : fromSeller ? 2 : 0;

      console.log("[EFRO PriceExplanation]", {
        text: normalizedForSellerBrain,
        primaryTitle: primary?.title,
        primaryPrice: primary?.price,
        contextFromRef,
      });

      if (!primary) {
        sendDirectAiReply(
          "Ich habe gerade kein konkretes Produkt im Fokus. Schau dir bitte direkt im Shop ein Produkt an – dort siehst du den exakten Preis.",
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

    // Normale Produktanfrage → SellerBrain
    // EFRO VOICE+CHAT FIX 2025-12-10: User-Message wird bereits in handleUserTextInput hinzugefügt
    try {
      console.log("[EFRO Chat] processing user message", { text: rawCleaned });

      const context: SellerBrainContext | undefined =
        sellerContext.activeCategorySlug
          ? { activeCategorySlug: sellerContext.activeCategorySlug }
          : undefined;

      console.log("[EFRO Client] Sending sellerContext", {
        sellerContext,
        context,
        activeCategorySlug: sellerContext.activeCategorySlug,
      });

      console.log("[EFRO Pipeline] BEFORE runSellerBrain", {
        userText: normalizedForSellerBrain,
        sellerContext,
      });

      const resolvedShopDomain = resolveShopDomain();
      const resolvedLocale = resolveLocale();

      const normalizedDomain = (resolvedShopDomain || "")
        .trim()
        .toLowerCase();
      const isDemoShop =
        normalizedDomain === "demo" ||
        normalizedDomain.startsWith("demo.") ||
        normalizedDomain.endsWith(".demo") ||
        normalizedDomain === "test-shop.myshopify.com";
      const isLocalDevShop =
        normalizedDomain === "local-dev" ||
        normalizedDomain.startsWith("local-dev.");

      // Für demo/local-dev immer v1 verwenden (wie in Szenario-Tests)
      // Für andere Shops: V2 verwenden (bisheriges Verhalten)
      const useV2 = !isDemoShop && !isLocalDevShop;

      let result: SellerBrainResult | SellerBrainV2Result;

      if (useV2) {
        console.log("[EFRO SB V2] Calling runSellerBrainV2", {
          shopDomain: resolvedShopDomain,
          locale: resolvedLocale,
          text: normalizedForSellerBrain,
        });

        try {
          result = await runSellerBrainV2(
            normalizedForSellerBrain,
            sellerProducts,
            context,
            {
              shopDomain: resolvedShopDomain,
              locale: resolvedLocale,
              useCache: true,
            }
          );

          console.log("[EFRO SB V2] Result", {
            fromCache: (result as SellerBrainV2Result).fromCache,
            replyTextLength: result.replyText?.length ?? 0,
            recommendedCount: result.recommended?.length ?? 0,
          });
        } catch (err: any) {
          console.error("[EFRO SB V2] Error, falling back to v1", {
            error: err?.message || String(err),
            text: normalizedForSellerBrain,
          });

          result = runSellerBrain(
            normalizedForSellerBrain,
            sellerIntent,
            sellerProducts,
            shopPlan,
            sellerRecommended,
            context
          );
        }
      } else {
        console.log("[EFRO SB] Using runSellerBrain v1", {
          reason: isDemoShop
            ? "demo shop"
            : isLocalDevShop
            ? "local-dev shop"
            : "v1 forced",
          shopDomain: resolvedShopDomain,
          text: normalizedForSellerBrain,
        });

        result = runSellerBrain(
          normalizedForSellerBrain,
          sellerIntent,
          sellerProducts,
          shopPlan,
          sellerRecommended,
          context
        );
      }

      console.log("[EFRO SellerBrain] Result summary", {
        shopDomain: resolvedShopDomain,
        useV2,
        recommendedCount: result.recommended
          ? result.recommended.length
          : 0,
      });

      console.log("[EFRO Pipeline] AFTER runSellerBrain", {
        userText: normalizedForSellerBrain,
        result: {
          intent: result.intent,
          replyText: result.replyText,
          productCount: result.recommended?.length ?? 0,
          aiTrigger: result.aiTrigger,
          nextContext: result.nextContext,
        },
      });

      const replyText = (result.replyText || "").trim();

if (replyText.length > 0) {
  // zentrale EFRO-Antwort + TTS
  sendDirectAiReply(replyText, { speak: true });
} else {
  // Fallback, wenn SellerBrain nichts Sinnvolles liefert
  sendDirectAiReply(
    "Entschuldigung, ich konnte keine passende Antwort generieren. Bitte versuche es mit einer anderen Formulierung.",
    { speak: true }
  );
}


      const recommendations = result.recommended ?? [];

      console.log(
        "[EFRO Recommendations] received products from SellerBrain",
        {
          count: recommendations.length,
          titles: recommendations.slice(0, 5).map((p) => p.title),
          hasResult: !!result,
          resultIntent: result.intent,
        }
      );

      setLastRecommendedProducts(recommendations);
      setLastRecommendations(recommendations);

      setSellerResult(result);
      setLastProductResult(result);

      setSellerIntent(result.intent);
      setSellerReplyText(result.replyText);
      setSellerRecommended(recommendations);

      console.log("[EFRO Recommendations] State updated", {
        sellerResultSet: true,
        recommendedCount: recommendations.length,
        sellerResultRecommendedCount:
          result.recommended?.length ?? 0,
      });

      const nextContext = result.nextContext;
      if (nextContext) {
        setSellerContext((prev) => {
          const updated = {
            ...prev,
            ...(nextContext.activeCategorySlug != null
              ? { activeCategorySlug: nextContext.activeCategorySlug }
              : {}),
          };
          console.log("[EFRO Client] Updated sellerContext", {
            previous: prev,
            nextContext,
            updated,
            note: "activeCategorySlug wird nur aktualisiert, wenn es nicht null/undefined ist",
          });
          return updated;
        });
      } else {
        console.log(
          "[EFRO Client] No nextContext in result, keeping existing context",
          sellerContext
        );
      }

      const aiTrigger = result.aiTrigger;
      if (
        aiTrigger?.needsAiHelp &&
        Array.isArray(aiTrigger.unknownTerms) &&
        aiTrigger.unknownTerms.length > 0
      ) {
        console.log(
          "[EFRO Client AI-Trigger] Sending unknown terms to backend",
          {
            userText: cleanedText,
            aiTrigger,
          }
        );

        fetch("/api/efro/ai-unknown-terms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shopDomain: shopDomain,
            userText: normalizedForSellerBrain,
            aiTrigger,
            catalogMeta: {
              totalProducts: allProducts.length,
              categories: Array.from(
                new Set(
                  allProducts
                    .map(
                      (p) =>
                        (p as any).categorySlug || p.category || ""
                    )
                    .filter(Boolean)
                )
              ).slice(0, 20),
            },
          }),
          keepalive: true,
        }).catch((err) => {
          console.warn(
            "[EFRO Client AI-Trigger] Failed to send unknown terms",
            err
          );
        });
      }
    } catch (err: any) {
      console.error("[EFRO SellerBrain Error]", err);
      console.log(
        "[EFRO Recommendations] Error occurred - clearing product panel",
        {
          error: err?.message || String(err),
        }
      );

      void logEfroEvent({
        shopDomain: shopDomain || "local-dev",
        userText: normalizedForSellerBrain,
        intent: "error",
        productCount: 0,
        plan: shopPlan ?? null,
        hadError: true,
        errorMessage: err?.message
          ? String(err.message)
          : "Unknown SellerBrain error",
      });

      setSellerResult(null);
      setSellerRecommended([]);
      setSellerReplyText(
        "Entschuldigung, es gab einen Fehler bei der Produktsuche."
      );
    }
  },
  [
    allProducts,
    sellerIntent,
    shopPlan,
    sellerRecommended,
    lastRecommendedProducts,
    lastRecommendations,
    sellerContext,
    shopDomain,
  ]
);

  /* ===========================================================
      ZENTRALE USER-INPUT-HANDLUNG (Voice + Chat)
  ============================================================ */
  // EFRO VOICE+CHAT FIX 2025-12-10 – gemeinsame handleUserTextInput-Pipeline

  const handleUserTextInput = useCallback(
    async (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) {
        console.log("[EFRO UserInput] Empty text, skipping");
        return;
      }

      console.log("[EFRO UserInput] IN", { text: cleaned });

      // User-Message sofort in Chat-State schreiben
      appendChatMessage({
        id: `user-${Date.now()}`,
        text: cleaned,
        sender: "user",
      });

      // SellerBrain + AI-Resolver Pipeline aufrufen
      await createRecommendations(cleaned);

      console.log("[EFRO UserInput] SellerBrain done", { text: cleaned });
    },
    [createRecommendations, appendChatMessage]
  );

  /* ===========================================================
      RENDER
  ============================================================ */

  console.log("[EFRO Chat] render", {
    count: chatMessages.length,
    messages: chatMessages,
  });

  // Debug: Log sellerResult vor dem Rendern
  // Fallback: Verwende sellerRecommended, falls sellerResult.recommended leer ist
  const productsFromResult = sellerResult?.recommended ?? [];
  const productsFromState = sellerRecommended;
  const productPanelProducts = productsFromResult.length > 0 ? productsFromResult : productsFromState;
  
  const productPanelVisible =
    (!!sellerResult &&
      sellerResult.recommended !== undefined &&
      sellerResult.recommended.length > 0) ||
    (productPanelProducts.length > 0);

  console.log("[EFRO ProductPanel] Render check", {
    hasSellerResult: !!sellerResult,
    recommendedDefined: sellerResult?.recommended !== undefined,
    recommendedLength: sellerResult?.recommended?.length ?? 0,
    sellerRecommendedLength: sellerRecommended.length,
    productPanelProductsCount: productPanelProducts.length,
    visible: productPanelVisible,
    usingFallback: productsFromResult.length === 0 && productsFromState.length > 0,
  });

  return (
    <main className="w-full min-h-screen bg-[#FFF8F0] relative overflow-hidden">
      {/* PRODUKT-PANEL */}
      <EfroProductPanel
        visible={productPanelVisible}
        products={productPanelProducts}
        replyText={sellerResult?.replyText ?? sellerReplyText}
      />

      {/* AVATAR + VOICE + CHAT – Floating-Overlay unten rechts */}
      {mascotUrl && (
        <div className="fixed bottom-4 right-4 z-40 pointer-events-none">
          <div className="w-[320px] rounded-3xl shadow-2xl border border-slate-200 bg-white/90 backdrop-blur-md pointer-events-auto flex flex-col overflow-hidden">
            {/* 🧸 Avatar-Bereich */}
            <div className="relative w-full aspect-[4/3] bg-slate-950/5 flex items-center justify-center">
              <AvatarPreview src={mascotUrl} className="w-full h-full">
                <ElevenLabsAvatar
                  dynamicVariables={dynamicVariables}
                  createRecommendations={createRecommendations}
                  setChatMessages={setChatMessages}
                  handleUserTextInput={handleUserTextInput}
                  registerSpeakHandler={registerSpeakHandler}
                  registerStartHandler={registerStartHandler}
                  registerStopHandler={registerStopHandler}
                />
              </AvatarPreview>
            </div>

            {/* 🧠 Button-Leiste unter dem Avatar */}
            <div className="border-t border-slate-100 bg-slate-50/90 px-3 py-2 flex flex-row items-center gap-2 justify-between">
              {/* Mit EFRO sprechen (Voice) */}
              <button
                type="button"
                onClick={() => {
                  if (isVoiceActive) {
                    console.log("[EFRO AvatarUI] Stop Voice clicked");
                    stopVoiceSession();
                    setIsVoiceActive(false);
                  } else {
                    console.log("[EFRO AvatarUI] Start Voice clicked");
                    startVoiceSession();
                    setIsVoiceActive(true);
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-full bg-emerald-600 text-white text-xs font-semibold px-3 py-2 shadow-sm hover:bg-emerald-500 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 active:shadow-inner transition"
              >
                <span aria-hidden="true">🎤</span>
                <span>{isVoiceActive ? "Gespräch beenden" : "Mit EFRO sprechen"}</span>
              </button>

              {/* Chat öffnen */}
              <button
                type="button"
                onClick={() => {
                  console.log("[EFRO AvatarUI] Toggle Chat clicked");
                  setIsChatOpen((prev) => !prev);
                }}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-full border border-slate-300 bg-white text-slate-800 text-xs font-medium px-3 py-2 shadow-sm hover:bg-slate-100 hover:shadow-md hover:-translate-y-[1px] active:translate-y-0 active:shadow-inner transition"
              >
                <span aria-hidden="true">💬</span>
                <span>{isChatOpen ? "Chat schließen" : "Chat öffnen"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EFRO CHAT WINDOW */}
      <EFROChatWindow
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        onSend={handleUserTextInput}
        messages={chatMessages.map((m) => ({
          id: m.id,
          text: m.text,
          role: m.sender === "user" ? "user" : "efro",
          createdAt: Date.now(),
        }))}
      />

      {/* DEBUG CHAT OVERLAY – nur für Entwicklung */}
      {showDebugOverlay && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 16,
            maxWidth: "420px",
            maxHeight: "50vh",
            overflowY: "auto",
            padding: "12px",
            background: "rgba(0,0,0,0.85)",
            color: "#fff",
            fontSize: "12px",
            borderRadius: "12px",
            zIndex: 9999,
          }}
        >
          <button
            type="button"
            onClick={() => setShowDebugOverlay(false)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              fontSize: "16px",
              lineHeight: "1",
              padding: "4px 8px",
              background: "rgba(255, 255, 255, 0.2)",
              color: "#fff",
              borderRadius: "4px",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "rgba(255, 255, 255, 0.2)";
            }}
          >
            ×
          </button>
          <div style={{ marginBottom: 8, opacity: 0.7 }}>
            EFRO DEBUG-CHAT ({chatMessages.length} Messages)
          </div>
          <div style={{ marginBottom: 8, fontSize: "10px", opacity: 0.6 }}>
            ⚠️ Nur EFRO-Chat (SellerBrain-Reply). ElevenLabs-Agent-Nachrichten
            werden ignoriert (siehe Console: [ElevenLabs AI ignored]).
          </div>
          {chatMessages.map((m, idx) => {
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
              console.warn("[EFRO Chat] message ohne text", m);
              return (
                <div key={m.id ?? idx} style={{ marginBottom: 4 }}>
                  <strong>{m.sender ?? "?"}</strong>: [kein Text-Feld gefunden]
                </div>
              );
            }

            const isUser = m.sender === "user";
            const bgColor = isUser
              ? "rgba(255, 165, 0, 0.2)"
              : "rgba(255, 255, 255, 0.1)";
            const textColor = isUser ? "#ffa500" : "#fff";

            return (
              <div
                key={m.id ?? idx}
                style={{
                  marginBottom: 4,
                  padding: "4px 8px",
                  background: bgColor,
                  borderRadius: "4px",
                }}
              >
                <strong style={{ color: textColor }}>
                  {m.sender === "user" ? "👤 User" : "🤖 EFRO"}
                </strong>
                : <span style={{ color: textColor }}>{text}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
