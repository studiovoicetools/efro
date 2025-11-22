import React from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type EFROProductCardsProps = {
  products: EfroProduct[];
};

export default function EFROProductCards({ products }: EFROProductCardsProps) {
  if (!products || products.length === 0) {
    return <p>Keine Produkte verfuegbar.</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: "1rem",
      }}
    >
      {products.map((p) => (
        <article
          key={p.id}
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            padding: "1rem",
            background: "#ffffff",
            boxShadow: "0 10px 25px rgba(15,23,42,0.04)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {p.imageUrl && (
            <div
              style={{
                marginBottom: "0.75rem",
                borderRadius: "10px",
                overflow: "hidden",
                border: "1px solid #e5e7eb",
                maxHeight: "160px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f9fafb",
              }}
            >
              <img
                src={p.imageUrl}
                alt={p.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
            </div>
          )}

          <h3
            style={{
              fontSize: "1rem",
              margin: "0 0 0.35rem",
              color: "#111827",
            }}
          >
            {p.title}
          </h3>
          <p
            style={{
              fontSize: "0.9rem",
              lineHeight: 1.4,
              margin: "0 0 0.5rem",
              color: "#4b5563",
              flexGrow: 1,
            }}
          >
            {p.description}
          </p>

          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 600,
              marginBottom: "0.35rem",
              color: "#111827",
            }}
          >
            {p.price.toFixed(2)} €
          </div>

          <div
            style={{
              fontSize: "0.8rem",
              color: "#6b7280",
            }}
          >
            Kategorie: {p.category || "–"}{" "}
            {p.tags && p.tags.length > 0 && (
              <>
                | Tags: {p.tags.join(", ")}
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
