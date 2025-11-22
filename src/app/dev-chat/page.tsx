// src/app/dev-chat/page.tsx
"use client";

import { useEffect, useState } from "react";
import EFROChatWindow from "@/components/EFROChatWindow";
import {
  ShoppingIntent,
  mockCatalog,
  EfroProduct,
} from "@/lib/products/mockCatalog";
import EFROProductCards from "@/components/EFROProductCards";
import { buildShopifyAdminProductUrl } from "@/lib/products/shopifyLinks";
import { runSellerBrain } from "@/lib/sales/sellerBrain";

type ChatMessage = {
  id: string;
  text: string;
  sender: "user" | "efro";
};

export default function DevChatPage() {
  const [isOpen, setIsOpen] = useState(true);

  // Aktueller Intent
  const [currentIntent, setCurrentIntent] =
    useState<ShoppingIntent>("quick_buy");

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "efro",
      text:
        "Hey, ich bin EFRO, dein Verkaufsavatar im Dev-Modus. " +
        "Schreib mir zum Beispiel: 'Ich will etwas guenstiges' oder 'Zeig mir ein Premium-Produkt', " +
        "und ich mache dir passende Vorschlaege aus deinem Produktkatalog.",
    },
  ]);

  // zentrale Produktquelle
  const [allProducts, setAllProducts] = useState<EfroProduct[]>(mockCatalog);
  const [productsSource, setProductsSource] = useState<string>(
    "mockCatalog (initial)"
  );

  const [lastRecommended, setLastRecommended] = useState<EfroProduct[]>([]);

  // Dev-Store Domain fuer Admin-Links
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
        console.error("[dev-chat] failed to load products from API:", err);
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

  const handleSend = (userText: string) => {
    const idUser = "u-" + Date.now().toString();
    const idEfro = "e-" + (Date.now() + 1).toString();

    // 1) User Nachricht in den Verlauf
    setMessages((prev) => [
      ...prev,
      {
        id: idUser,
        sender: "user",
        text: userText,
      },
    ]);

    // 2) SellerBrain berechnet Intent, Empfehlungen und Antworttext
    const brainResult = runSellerBrain(userText, currentIntent, allProducts);

    setCurrentIntent(brainResult.intent);
    setLastRecommended(brainResult.recommended);

    // 3) EFRO Antwort in den Verlauf
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
    const url = buildShopifyAdminProductUrl(String(product.id), devShopDomain);
    if (!url) {
      console.warn("[dev-chat] could not build admin URL for product", product);
      alert(
        `Keine gueltige Admin-URL fuer dieses Produkt ableitbar.\nID: ${product.id}`
      );
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <h1>EFRO Dev Chat Playground</h1>
      <p style={{ maxWidth: 600, marginTop: "0.5rem" }}>
        Diese Seite simuliert den Verkaufs-Chat von EFRO komplett lokal.
        Die Produktdaten kommen ueber eine zentrale Funktion
        (aktuell Runtime-Produkte deines Dev-Shops).
      </p>

      {/* DEBUG-INFOS OBEN */}
      <p
        style={{
          marginTop: "0.25rem",
          fontSize: "0.85rem",
          color: "#6b7280",
        }}
      >
        Product source: <strong>{productsSource}</strong>
      </p>
      <p
        style={{
          marginTop: "0.1rem",
          fontSize: "0.85rem",
          color: "#6b7280",
        }}
      >
        Aktueller Intent:{" "}
        <strong style={{ textTransform: "uppercase" }}>
          {currentIntent}
        </strong>
      </p>

      <section
        style={{
          marginTop: "1.5rem",
          padding: "1rem",
          borderRadius: "10px",
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          maxWidth: 800,
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
          Debug Chat View (immer sichtbar)
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#4b5563" }}>
          Hier siehst du alle Messages, auch wenn das Floating-Chatfenster
          unten rechts einmal nicht richtig angezeigt wird.
        </p>

        <div
          style={{
            marginTop: "0.75rem",
            maxHeight: "300px",
            overflowY: "auto",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            background: "white",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
              }}
            >
              <div
                style={{
                  padding: "0.4rem 0.7rem",
                  borderRadius: "999px",
                  fontSize: "0.9rem",
                  background:
                    m.sender === "user" ? "#f97316" : "#e5e7eb",
                  color: m.sender === "user" ? "white" : "#111827",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ maxWidth: 800 }}>
        <EFROProductCards
          products={lastRecommended}
          title="Empfehlungen aus der letzten EFRO-Antwort (klickbar -> Admin Produktseite)"
          onProductClick={handleCardClick}
        />
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid #ccc",
            background: isOpen ? "#f97316" : "#ffffff",
            color: isOpen ? "white" : "#111827",
            cursor: "pointer",
          }}
        >
          {isOpen ? "Chat schliessen" : "Chat oeffnen"}
        </button>
      </div>

      <EFROChatWindow
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSend={handleSend}
        messages={messages}
      />
    </main>
  );
}
