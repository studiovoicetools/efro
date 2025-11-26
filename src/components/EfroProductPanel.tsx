"use client";

import React from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type EfroProductPanelProps = {
  visible: boolean;
  products: EfroProduct[];
  replyText: string;
};

function formatPrice(price?: number | null): string {
  if (price == null) return "Preis auf Anfrage";
  return `${price.toFixed(2).replace(".", ",")} €`;
}

function getShortFeatures(description?: string | null): string[] {
  if (!description) return [];

  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const parts = clean
    .split(/[\.\n•\-]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 5);

  return parts.slice(0, 2);
}

function getProductUrl(product: EfroProduct): string | null {
  const anyProd = product as any;

  return (
    anyProd.url ||
    anyProd.productUrl ||
    anyProd.onlineStoreUrl ||
    anyProd.shopifyUrl ||
    null
  );
}

export const EfroProductPanel: React.FC<EfroProductPanelProps> = ({
  visible,
  products,
  replyText,
}) => {
  if (!visible || !products || products.length === 0) return null;

  return (
    <div className="fixed left-4 bottom-4 z-40 w-[380px] max-h-[70vh] rounded-2xl bg-white/95 shadow-2xl border border-slate-200 flex flex-col overflow-hidden backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 text-sm font-semibold">
            🛒
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-800">
              EFROs Produktempfehlungen
            </span>
            <span className="text-[11px] text-slate-500">
              {products.length === 1
                ? "1 Produkt gefunden"
                : `${products.length} passende Produkte`}
            </span>
          </div>
        </div>
      </div>

      {/* Erklärtext aus SellerBrain */}
      {replyText && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-xs leading-relaxed text-slate-600 whitespace-pre-line">
            {replyText}
          </p>
        </div>
      )}

      {/* Produktliste */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {products.map((product, idx) => {
          const features = getShortFeatures(product.description);
          const url = getProductUrl(product);
          const hasImage = !!(product as any).image;

          return (
            <div
              key={`${product.id ?? product.title}-${idx}`}
              className="rounded-xl border border-slate-200 bg-white/90 shadow-sm hover:shadow-md transition-shadow flex gap-3 p-3"
            >
              {/* Bild / Placeholder */}
              <div className="flex-shrink-0">
                {hasImage ? (
                  <img
                    src={(product as any).image}
                    alt={product.title}
                    className="h-20 w-20 rounded-lg object-cover border border-slate-100"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 text-xs border border-slate-200">
                    Kein Bild
                  </div>
                )}
              </div>

              {/* Textbereich */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col min-w-0">
                    {product.category && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[10px] font-medium text-slate-600 mb-1">
                        {product.category}
                      </span>
                    )}
                    <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                      {product.title}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className="text-sm font-bold text-indigo-700">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                </div>

                {features.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {features.map((f, i) => (
                      <li
                        key={i}
                        className="text-[11px] text-slate-600 leading-snug flex gap-1"
                      >
                        <span className="mt-[2px] text-[9px]">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-2 flex items-center justify-between gap-2">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-medium px-3 py-1.5 transition-colors"
                    >
                      Zum Produkt im Shop
                    </a>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-400 text-[10px] px-2 py-1">
                      Link im Shop nicht hinterlegt
                    </span>
                  )}

                  <span className="text-[9px] text-slate-500 text-right">
                    Mehr Details (z. B. Inhaltsstoffe) findest du auf der
                    Produktseite.
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
