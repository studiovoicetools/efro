"use client";

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string | null;
  compareAtPrice: string | null;
  url: string;
  available: boolean;
}

export function ChatProductList({ items }: { items: ShopifyProduct[] }) {
  if (!items?.length)
    return <div className="text-sm text-neutral-500">Keine Produkte gefunden.</div>;

  return (
    <div className="grid grid-cols-1 gap-3">
      {items.map((p) => (
        <a
          key={p.id}
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 rounded-2xl border p-3 hover:bg-neutral-50 transition-colors"
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-neutral-100">
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.imageAlt || p.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-sm">{p.title}</div>
            <div className="text-sm text-neutral-600 mt-1">
              {p.price ? (
                <>
                  <b>{Number(p.price).toFixed(2)} €</b>
                  {p.compareAtPrice && (
                    <span className="line-through text-neutral-400 ml-2">
                      {Number(p.compareAtPrice).toFixed(2)} €
                    </span>
                  )}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}