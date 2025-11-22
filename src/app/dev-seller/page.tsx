// src/app/dev-seller/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShoppingIntent,
  mockCatalog,
  EfroProduct,
} from "@/lib/products/mockCatalog";
import { useSellerBrain } from "@/lib/sales/useSellerBrain";
import { getRelatedProducts } from "@/lib/products/relatedProducts";

const intentOptions: { value: ShoppingIntent; label: string }[] = [
  { value: "quick_buy", label: "Quick buy (schnelle Entscheidung)" },
  { value: "bargain", label: "Bargain (moeglichst guenstig)" },
  { value: "premium", label: "Premium (Qualitaet, Preis egal)" },
  { value: "gift", label: "Gift (Geschenk)" },
  { value: "bundle", label: "Bundle / Set" },
  { value: "explore", label: "Explore (Inspiration)" },
];

export default function DevSellerPage() {
  const {
    intent,
    setIntent,
    recommendedProducts,
    salesMessage,
    cart,
    cartTotal,
    addToCart,
    removeOneFromCart,
    removeFromCart,
  } = useSellerBrain("quick_buy");

  // Zentrale Produktliste: kommt aus der API (jetzt noch mockCatalog)
  const [allProducts, setAllProducts] = useState<EfroProduct[]>(mockCatalog);
  const [productsSource, setProductsSource] = useState<string>(
    "mockCatalog (initial)"
  );

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
        console.error("[dev-seller] failed to load products from API:", err);
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

  // Related Products pro empfohlenem Produkt berechnen (auf Basis allProducts)
  const relatedById = useMemo(() => {
    const map = new Map<string, EfroProduct[]>();
    for (const p of recommendedProducts) {
      const related = getRelatedProducts(p, allProducts, 2);
      map.set(p.id, related);
    }
    return map;
  }, [recommendedProducts, allProducts]);

  return (
    <main
      style={{
        padding: "2rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "grid",
        gap: "2rem",
        gridTemplateColumns: "2fr 1fr",
        alignItems: "flex-start",
      }}
    >
      {/* Left side: products + recommendations */}
      <section>
        <h1>EFRO Dev Seller Playground</h1>
        <p>
          Diese Seite ist nur fuer die lokale Entwicklung deines Multi Super
          Verkaeufers. Die Produktdaten kommen ueber eine zentrale Funktion
          (getEfroProductsForShop) aktuell noch aus dem Mock Katalog.
        </p>

        <p
          style={{
            marginTop: "0.5rem",
            fontSize: "0.85rem",
            color: "#6b7280",
          }}
        >
          Product source: <strong>{productsSource}</strong>
        </p>

        {/* Intent Auswahl */}
        <div
          style={{
            margin: "1rem 0",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
            background: "#f9fafb",
          }}
        >
          <strong>Customer intent (Kundentyp):</strong>
          <div
            style={{
              marginTop: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              fontSize: "0.9rem",
            }}
          >
            {intentOptions.map((opt) => (
              <label
                key={opt.value}
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <input
                  type="radio"
                  name="intent"
                  value={opt.value}
                  checked={intent === opt.value}
                  onChange={() => setIntent(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Empfehlungs-Bereich */}
        <section
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            border: "1px solid #e5e5e5",
            background: "#fefce8",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div>
            <h2 style={{ marginTop: 0, marginBottom: "0.4rem" }}>
              Recommended for this customer
            </h2>
            <p style={{ marginTop: 0, fontSize: "0.9rem", color: "#555" }}>
              Diese Produkte wuerde dein Avatar fuer den ausgewaehlten
              Kundentyp zuerst vorschlagen.
            </p>
          </div>

          {/* Karten mit empfohlenen Produkten */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "1rem",
            }}
          >
            {recommendedProducts.map((p) => {
              const related = relatedById.get(p.id) ?? [];
              return (
                <article
                  key={p.id}
                  style={{
                    border: "1px solid #facc15",
                    borderRadius: "8px",
                    padding: "0.75rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    background: "#fffbeb",
                  }}
                >
                  <div>
                    <strong>{p.title}</strong>
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#555" }}>
                    {p.description}
                  </div>
                  <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>
                    {p.price.toFixed(2)} €
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(p)}
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.4rem 0.75rem",
                      borderRadius: "6px",
                      border: "none",
                      background: "#2563eb",
                      color: "white",
                      cursor: "pointer",
                      fontSize: "0.9rem",
                    }}
                  >
                    Add to cart
                  </button>

                  {/* Related Products (Cross-Sell) */}
                  {related.length > 0 && (
                    <div
                      style={{
                        marginTop: "0.5rem",
                        paddingTop: "0.5rem",
                        borderTop: "1px dashed #eab308",
                        fontSize: "0.85rem",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 600,
                          marginBottom: "0.25rem",
                          color: "#92400e",
                        }}
                      >
                        Passt gut dazu:
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: "1.1rem",
                          listStyle: "disc",
                        }}
                      >
                        {related.map((rp) => (
                          <li key={rp.id}>
                            {rp.title} ({rp.price.toFixed(2)} €)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Avatar-Text-Vorschau */}
          <div
            style={{
              marginTop: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px dashed #eab308",
              background: "#fffbeb",
            }}
          >
            <h3
              style={{
                marginTop: 0,
                marginBottom: "0.4rem",
                fontSize: "1rem",
              }}
            >
              Avatar pitch preview (Text, den EFRO sprechen wuerde)
            </h3>
            <p style={{ marginTop: 0, fontSize: "0.9rem" }}>
              {salesMessage.intro}
            </p>
            <ul
              style={{
                margin: "0.25rem 0 0.5rem 1rem",
                padding: 0,
                fontSize: "0.9rem",
              }}
            >
              {salesMessage.productLines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
            <p style={{ marginTop: 0, fontSize: "0.9rem" }}>
              {salesMessage.closing}
            </p>
          </div>
        </section>

        {/* Alle Produkte (aus zentraler Quelle) */}
        <h2 style={{ marginTop: "2rem" }}>
          All products (source: {productsSource}) ({allProducts.length})
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
            marginTop: "1rem",
          }}
        >
          {allProducts.map((p) => (
            <article
              key={p.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: "8px",
                padding: "0.75rem 1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                background: "#fafafa",
              }}
            >
              <div>
                <strong>{p.title}</strong>
              </div>
              <div style={{ fontSize: "0.9rem", color: "#555" }}>
                {p.description}
              </div>
              <div style={{ fontWeight: 600, marginTop: "0.25rem" }}>
                {p.price.toFixed(2)} €
              </div>
              <div style={{ fontSize: "0.8rem", color: "#777" }}>
                Tags: {p.tags.join(", ")}
              </div>
              <button
                type="button"
                onClick={() => addToCart(p)}
                style={{
                  marginTop: "0.5rem",
                  padding: "0.4rem 0.75rem",
                  borderRadius: "6px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "0.9rem",
                }}
              >
                Add to cart
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* Right side: cart */}
      <aside
        style={{
          border: "1px solid #ddd",
          borderRadius: "10px",
          padding: "1rem 1.25rem",
          background: "#fdfdfd",
          minWidth: 0,
        }}
      >
        <h2>Cart</h2>
        {cart.length === 0 ? (
          <p style={{ color: "#666" }}>Cart is empty.</p>
        ) : (
          <>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: "0 0 1rem 0",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {cart.map((item) => (
                <li
                  key={item.product.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    borderBottom: "1px solid #eee",
                    paddingBottom: "0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>{item.product.title}</span>
                    <span>
                      {(item.product.price * item.quantity).toFixed(2)} €
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginTop: "0.3rem",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span>Qty: {item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => removeOneFromCart(item.product.id)}
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      -1
                    </button>
                    <button
                      type="button"
                      onClick={() => addToCart(item.product)}
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      +1
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.product.id)}
                      style={{
                        marginLeft: "auto",
                        padding: "0.2rem 0.6rem",
                        borderRadius: "4px",
                        border: "none",
                        background: "#ef4444",
                        color: "white",
                        cursor: "pointer",
                        fontSize: "0.8rem",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 600,
                marginBottom: "0.75rem",
              }}
            >
              <span>Total</span>
              <span>{cartTotal.toFixed(2)} €</span>
            </div>

            <button
              type="button"
              style={{
                width: "100%",
                padding: "0.6rem 1rem",
                borderRadius: "8px",
                border: "none",
                background: "#16a34a",
                color: "white",
                cursor: "pointer",
                fontSize: "0.95rem",
              }}
              onClick={() =>
                alert(
                  `Checkout simulation: ${cart.length} items, total ${cartTotal.toFixed(
                    2
                  )} €`
                )
              }
            >
              Simulate checkout
            </button>
          </>
        )}
      </aside>
    </main>
  );
}
