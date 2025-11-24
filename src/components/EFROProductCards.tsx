import React from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type EFROProductCardsProps = {
  products: EfroProduct[];
  variant?: "default" | "compact";
  title?: string;
  onProductClick?: (product: EfroProduct) => void;
};

export default function EFROProductCards({ products, variant = "default", title, onProductClick }: EFROProductCardsProps) {
  if (!products || products.length === 0) {
    return <p>Keine Produkte verfuegbar.</p>;
  }

  const isCompact = variant === "compact";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isCompact ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))",
        gap: isCompact ? "0.5rem" : "1rem",
      }}
    >
      {title && (
        <h2
          style={{
            fontSize: isCompact ? "0.875rem" : "1rem",
            fontWeight: 600,
            marginBottom: isCompact ? "0.25rem" : "0.5rem",
            color: "#111827",
            gridColumn: "1 / -1",
          }}
        >
          {title}
        </h2>
      )}
      {products.map((p) => (
        <article
          key={p.id}
          onClick={() => onProductClick?.(p)}
          style={{
            cursor: onProductClick ? "pointer" : "default",
            borderRadius: isCompact ? "8px" : "12px",
            border: "1px solid #e5e7eb",
            padding: isCompact ? "0.5rem" : "1rem",
            background: "#ffffff",
            boxShadow: "0 10px 25px rgba(15,23,42,0.04)",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            transition: onProductClick ? "transform 0.2s, box-shadow 0.2s" : "none",
          }}
          onMouseEnter={(e) => {
            if (onProductClick) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 12px 28px rgba(15,23,42,0.08)";
            }
          }}
          onMouseLeave={(e) => {
            if (onProductClick) {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 25px rgba(15,23,42,0.04)";
            }
          }}
        >
          {p.imageUrl && !isCompact && (
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
              fontSize: isCompact ? "0.875rem" : "1rem",
              margin: "0 0 0.25rem",
              color: "#111827",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.title}
          </h3>
          {!isCompact && (
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
          )}
          {isCompact && p.description && (
            <p
              style={{
                fontSize: "0.75rem",
                lineHeight: 1.3,
                margin: "0 0 0.25rem",
                color: "#6b7280",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                maxHeight: "2.6rem",
              }}
            >
              {p.description.length > 80 ? `${p.description.slice(0, 80)}...` : p.description}
            </p>
          )}

          <div
            style={{
              fontSize: isCompact ? "0.875rem" : "0.95rem",
              fontWeight: 600,
              marginBottom: isCompact ? "0.25rem" : "0.35rem",
              color: "#111827",
            }}
          >
            {p.price.toFixed(2)} €
          </div>

          <div
            style={{
              fontSize: isCompact ? "0.7rem" : "0.8rem",
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
