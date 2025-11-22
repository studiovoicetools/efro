// src/app/avatar-seller/page.tsx
"use client";

import { useEffect, useState } from "react";
import {
  MascotProvider,
  MascotClient,
  MascotRive,
  Alignment,
  Fit,
} from "@mascotbot-sdk/react";

// HIER: nur diese 5 Imports von @/... auf relative Pfade umgestellt
import EFROChatWindow from "../../components/EFROChatWindow";
import {
  ShoppingIntent,
  EfroProduct,
  mockCatalog,
} from "../../lib/products/mockCatalog";
import EFROProductCards from "../../components/EFROProductCards";
import { buildShopifyAdminProductUrl } from "../../lib/products/shopifyLinks";
import { runSellerBrain } from "../../lib/sales/sellerBrain";

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "efro";
};

function SellerAvatarWithBrain({
  allProducts,
  shopDomain,
  productsSource,
}: {
  allProducts: EfroProduct[];
  shopDomain: string;
  productsSource: string;
}) {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [currentIntent, setCurrentIntent] =
    useState<ShoppingIntent>("quick_buy");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "efro",
      text:
        "Hey, ich bin EFRO, dein Verkaufsavatar. Schreib mir zum Beispiel: " +
        "'Ich will etwas guenstiges' oder 'Zeig mir ein Premium Produkt', " +
        "und ich mache dir passende Vorschlaege aus deinem Produktkatalog.",
    },
  ]);

  const [lastRecommended, setLastRecommended] = useState<EfroProduct[]>([]);

  const handleChatSend = (userText: string) => {
    const idUser = "u-" + Date.now().toString();
    const idEfro = "e-" + (Date.now() + 1).toString();

    // User Nachricht
    setMessages((prev) => [
      ...prev,
      {
        id: idUser,
        sender: "user",
        text: userText,
      },
    ]);

    // SellerBrain
    const brainResult = runSellerBrain(userText, currentIntent, allProducts);

    setCurrentIntent(brainResult.intent);
    setLastRecommended(brainResult.recommended);

    // EFRO Antwort
    setMessages((prev) => [
      ...prev,
      {
        id: idEfro,
        sender: "efro",
        text: brainResult.replyText,
      },
    ]);
  };

  const handleCardClick = (product: EfroProduct) => {
    const url = buildShopifyAdminProductUrl(String(product.id), shopDomain);
    if (!url) {
      console.warn("[avatar-seller] could not build admin URL", product);
      alert(
        `Keine gueltige Admin-URL fuer dieses Produkt ableitbar.\nID: ${product.id}`
      );
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* DEBUG-BOX: Product source + Intent */}
      <div className="fixed top-4 left-4 z-40 bg-white/80 border rounded-lg px-3 py-2 text-xs text-gray-700 shadow">
        <div>
          Product source:{" "}
          <span className="font-semibold">{productsSource}</span>
        </div>
        <div className="mt-1">
          Aktueller Intent:{" "}
          <span className="font-semibold uppercase">
            {currentIntent}
          </span>
        </div>
      </div>

      {/* Karten links unten */}
      <div className="fixed bottom-4 left-4 z-30 w-[360px] max-w-[80vw]">
        <EFROProductCards
          products={lastRecommended}
          title="EFRO empfiehlt gerade (klickbar -> Admin Produktseite)"
          onProductClick={handleCardClick}
        />
      </div>

      {isChatOpen && (
        <EFROChatWindow
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSend={handleChatSend}
          messages={messages}
        />
      )}

      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
        <div className="w-80 h-80 pointer-events-none">
          <MascotRive />
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setIsChatOpen((open) => !open)}
            className="h-12 px-5 bg-white text-gray-800 border rounded-lg shadow"
          >
            {isChatOpen ? "Chat schliessen" : "Chat oeffnen"}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AvatarSellerPage() {
  const mascotUrl = "/retroBot.riv";

  const [allProducts, setAllProducts] = useState<EfroProduct[]>(mockCatalog);
  const [productsSource, setProductsSource] = useState<string>(
    "mockCatalog (initial)"
  );

  // Dev-Store Domain
  const devShopDomain = "avatarsalespro-dev.myshopify.com";

  useEffect(() => {
    let cancelled = false;

    const loadProducts = async () => {
      try {
        const res = await fetch(
          "/api/efro/debug-products?shop=local-dev",
          { cache: "no-store" }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;

        if (Array.isArray(data.products)) {
          setAllProducts(data.products);
        }
        if (typeof data.source === "string") {
          setProductsSource(data.source);
        } else {
          setProductsSource("getEfroProductsForShop (no explicit source)");
        }
      } catch (err) {
        console.error("[avatar-seller] failed to load products from API:", err);
        if (!cancelled) {
          setProductsSource("mockCatalog (fallback, API failed)");
          setAllProducts(mockCatalog);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <MascotProvider>
      <main className="w-full h-screen bg-[#FFF8F0]">
        <MascotClient
          src={mascotUrl}
          artboard="Character"
          inputs={["is_speaking", "gesture"]}
          layout={{
            fit: Fit.Contain,
            alignment: Alignment.BottomRight,
          }}
        >
          <SellerAvatarWithBrain
            allProducts={allProducts}
            shopDomain={devShopDomain}
            productsSource={productsSource}
          />
        </MascotClient>
      </main>
    </MascotProvider>
  );
}
