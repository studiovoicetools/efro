"use client";

import Image from "next/image";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type EFROProductCardsProps = {
  products: EfroProduct[];
  title?: string;
  onProductClick?: (product: EfroProduct) => void;
};

export default function EFROProductCards({
  products,
  title = "Empfohlene Produkte",
  onProductClick,
}: EFROProductCardsProps) {
  if (!products || products.length === 0) {
    return null;
  }

  const clickable = typeof onProductClick === "function";

  return (
    <section className="mt-6">
      <h2 className="text-sm font-semibold text-slate-900 mb-2">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <article
            key={p.id}
            onClick={() => {
              if (clickable) onProductClick?.(p);
            }}
            className={
              "bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col " +
              (clickable
                ? "cursor-pointer hover:shadow-md hover:border-orange-400 transition"
                : "")
            }
          >
            {/* Bildbereich */}
            <div className="relative w-full h-40 bg-slate-100">
              {p.imageUrl ? (
                <Image
                  src={p.imageUrl}
                  alt={p.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                  Kein Bild
                </div>
              )}
            </div>

            {/* Textbereich */}
            <div className="p-3 flex-1 flex flex-col">
              <h3 className="text-sm font-semibold text-slate-900 line-clamp-2">
                {p.title}
              </h3>
              {p.description && (
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                  {p.description}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-900">
                  {p.price.toFixed(2)} €
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                  {p.category || "generic"}
                </span>
              </div>

              {p.tags && p.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700"
                    >
                      #{tag}
                    </span>
                  ))}
                  {p.tags.length > 4 && (
                    <span className="text-[10px] text-slate-400">
                      +{p.tags.length - 4} mehr
                    </span>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
