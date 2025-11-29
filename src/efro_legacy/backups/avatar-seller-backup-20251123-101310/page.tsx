"use client";

import { useEffect, useState } from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";
import EFROProductCards from "@/components/EFROProductCards";

const EFRO_DEV_SHOP = "local-dev";

export default function AvatarSellerPage() {
  const [efroProducts, setEfroProducts] = useState<EfroProduct[]>(mockCatalog);
  const [status, setStatus] = useState<string>("loading...");
  const [productsSource, setProductsSource] = useState<string>("mockCatalog (initial)");

  useEffect(() => {
    let cancelled = false;

    async function loadEfroProducts() {
      try {
        const res = await fetch(`/api/efro/debug-products?shop=${EFRO_DEV_SHOP}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = await res.json();

        if (cancelled) return;

        if (Array.isArray(data.products) && data.products.length > 0) {
          setEfroProducts(data.products);
          setStatus("ok");
          setProductsSource(data.productsSource ?? data.source ?? "efro/debug-products");
        } else {
          setEfroProducts(mockCatalog);
          setStatus("fallback: empty EFRO list");
          setProductsSource("mockCatalog (fallback)");
        }
      } catch (err) {
        console.error("[avatar-seller] failed to load EFRO products", err);
        if (!cancelled) {
          setEfroProducts(mockCatalog);
          setStatus("fallback: error loading EFRO products");
          setProductsSource("mockCatalog (error)");
        }
      }
    }

    loadEfroProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main
      style={{
        padding: "1.5rem 2rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        display: "grid",
        gridTemplateColumns: "3fr minmax(320px, 1.2fr)",
        gap: "1.5rem",
        alignItems: "flex-start",
      }}
    >
      <section>
        <h1 style={{ marginTop: 0 }}>Avatar Seller – EFRO Products</h1>
        <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#4b5563" }}>
          Status: <strong>{status}</strong>
        </p>
        <p style={{ margin: "0.1rem 0 0.5rem", fontSize: "0.85rem", color: "#6b7280" }}>
          Source: <strong>{productsSource}</strong>
        </p>
        <p style={{ margin: "0.1rem 0 1rem", fontSize: "0.85rem", color: "#6b7280" }}>
          Total products: <strong>{efroProducts.length}</strong>
        </p>

        <EFROProductCards products={efroProducts} />
      </section>

      <aside
        style={{
          position: "sticky",
          top: "1.5rem",
          alignSelf: "flex-start",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          padding: "1rem",
          boxShadow: "0 10px 30px rgba(15,23,42,0.08)",
          height: "min(720px, 80vh)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <h2
          style={{
            fontSize: "1rem",
            margin: "0 0 0.75rem",
            color: "#111827",
          }}
        >
          EFRO Avatar (live)
        </h2>
        <p
          style={{
            fontSize: "0.85rem",
            margin: "0 0 0.75rem",
            color: "#4b5563",
          }}
        >
          Dies ist derselbe Avatar wie auf <code>/avatar</code>. Sprich mit ihm, waehrend du
          links die Produkte siehst.
        </p>
        <div
          style={{
            flex: 1,
            borderRadius: "10px",
            overflow: "hidden",
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          <iframe
            src="/avatar"
            title="EFRO Avatar"
            style={{
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
      </aside>
    </main>
  );
}
