"use client";

import { useEffect, useMemo, useState } from "react";
import type { EfroProduct } from "@/lib/products/mockCatalog";

type ProductsResponse = {
  shop?: string;
  count?: number;
  products?: EfroProduct[];
  source?: string;
};

type SourceMode = "runtime" | "demo";

export default function EfroAdminPage() {
  const [shopDomain, setShopDomain] = useState(
    "avatarsalespro-dev.myshopify.com"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    shop: string;
    count: number;
    products: EfroProduct[];
    source: string;
  } | null>(null);

  const [sourceMode, setSourceMode] = useState<SourceMode>("runtime");

  // kleine Kennzahlen aus den Produkten berechnen
  const stats = useMemo(() => {
    if (!data || !data.products || data.products.length === 0) {
      return null;
    }
    const prices = data.products.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    return { min, max, avg };
  }, [data]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Endpoint je nach Quelle
      const endpoint =
        sourceMode === "runtime"
          ? `/api/efro/debug-products?shop=${encodeURIComponent(shopDomain)}`
          : "/api/demo-products";

      const res = await fetch(endpoint, { cache: "no-store" });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json: any = await res.json();

      let products: EfroProduct[] = [];
      let shop = shopDomain;
      let sourceText = "";

      // Fall 1: API liefert direkt ein Array von Produkten
      if (Array.isArray(json)) {
        products = json as EfroProduct[];
        sourceText =
          sourceMode === "runtime"
            ? "runtime (array response)"
            : "demo (array response)";
      }
      // Fall 2: API liefert Objekt mit products[]
      else if (Array.isArray((json as ProductsResponse).products)) {
        const resp = json as ProductsResponse;
        products = resp.products as EfroProduct[];
        shop = resp.shop ?? shopDomain;
        sourceText =
          resp.source ??
          (sourceMode === "runtime"
            ? "runtime (object response)"
            : "demo (object response)");
      } else {
        throw new Error("Unexpected products shape in API response");
      }

      const count =
        typeof json.count === "number" ? json.count : products.length;

      setData({
        shop,
        count,
        products,
        source: sourceText,
      });
    } catch (err: any) {
      console.error("[EFRO Admin] loadProducts error:", err);
      setError(err?.message ?? "Unknown error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Beim ersten Aufruf automatisch fuer runtime laden
  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      className="min-h-screen bg-slate-50"
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            EFRO Admin Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-xl">
            Diese Seite zeigt dir, welche Produkte EFRO fuer einen bestimmten
            Shop aktuell sieht. Alle Daten kommen ueber die zentrale Funktion
            <code className="px-1 mx-1 bg-slate-200 rounded text-xs">
              getEfroProductsForShop
            </code>
            bzw. deine Demo-Quelle.
          </p>
        </header>

        {/* Source Auswahl + Shop + Reload */}
        <section className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col gap-3">
            {/* Source Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">
                  Source
                </div>
                <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setSourceMode("runtime")}
                    className={
                      "px-3 py-1.5 border-r border-slate-300 " +
                      (sourceMode === "runtime"
                        ? "bg-orange-500 text-white"
                        : "bg-white text-slate-800")
                    }
                  >
                    Runtime products
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode("demo")}
                    className={
                      "px-3 py-1.5 " +
                      (sourceMode === "demo"
                        ? "bg-orange-500 text-white"
                        : "bg-white text-slate-800")
                    }
                  >
                    Demo products
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Runtime: Produkte, die EFRO fuer den echten Shop nutzt. Demo:
                  Akku Schrauber, Duschgel usw. aus deiner Demo-Tabelle.
                </p>
              </div>

              <button
                type="button"
                onClick={loadProducts}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-lg border border-orange-500 bg-orange-500 text-white font-medium shadow-sm disabled:opacity-60 self-start"
              >
                {loading ? "Laedt..." : "Produkte laden"}
              </button>
            </div>

            {/* Shop Domain nur fuer runtime relevant */}
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Shop Domain (nur fuer runtime relevant)
                </label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                  placeholder="z. B. avatarsalespro-dev.myshopify.com"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Dieser Wert wird als{" "}
                  <code className="px-1 bg-slate-200 rounded text-[10px]">
                    ?shop=
                  </code>{" "}
                  Parameter an die runtime API uebergeben. Bei Demo wird er
                  ignoriert.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Status / Fehler */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            Fehler beim Laden der Produkte: {error}
          </div>
        )}

        {/* Zusammenfassung */}
        <section className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Aktuelle Source
            </div>
            <div className="mt-1 text-sm text-slate-900">
              {sourceMode === "runtime" ? "Runtime products" : "Demo products"}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              API Endpoint:
              <span className="ml-1 font-mono">
                {sourceMode === "runtime"
                  ? "/api/efro/debug-products"
                  : "/api/demo-products"}
              </span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Shop / Context
            </div>
            <div className="mt-1 text-sm font-mono text-slate-800 break-all">
              {data?.shop ?? (sourceMode === "runtime" ? shopDomain : "demo")}
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              Quelle:
              <span className="ml-1 font-mono">
                {data?.source ?? "unbekannt"}
              </span>
            </div>
          </div>

          <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">
              Anzahl Produkte
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {data?.count ?? 0}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Basierend auf der aktuell gewaehlten Source.
            </div>
          </div>
        </section>

        {/* Preis-Stats */}
        <section className="mb-6 p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 mb-1">
            Preis-Range (wenn verfuegbar)
          </div>
          {stats ? (
            <div className="mt-1 text-sm text-slate-900 flex gap-6 flex-wrap">
              <div>Min: {stats.min.toFixed(2)} €</div>
              <div>Max: {stats.max.toFixed(2)} €</div>
              <div>Avg: {stats.avg.toFixed(2)} €</div>
            </div>
          ) : (
            <div className="mt-1 text-sm text-slate-500">
              Noch keine gueltigen Preise oder keine Produkte.
            </div>
          )}
        </section>

        {/* Produktliste */}
        <section className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Produkte, die EFRO sieht
            </h2>
            <div className="text-[11px] text-slate-500">
              Zeigt maximal {data?.products?.length ?? 0} Produkte
            </div>
          </div>

          {!data && !loading && !error && (
            <p className="text-sm text-slate-500">
              Noch keine Daten geladen. Klicke oben auf{" "}
              <strong>Produkte laden</strong>.
            </p>
          )}

          {loading && (
            <p className="text-sm text-slate-500">Lade Produkte...</p>
          )}

          {data && data.products && data.products.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b border-slate-200">
                      Titel
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b border-slate-200">
                      Preis
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b border-slate-200">
                      Kategorie
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b border-slate-200">
                      Tags
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 border-b border-slate-200">
                      ID (gekuerzt)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr
                      key={p.id}
                      className="odd:bg-white even:bg-slate-50 align-top"
                    >
                      <td className="px-3 py-2 border-b border-slate-200">
                        <div className="font-medium text-slate-900">
                          {p.title}
                        </div>
                        {p.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-2">
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                        {p.price.toFixed(2)} €
                      </td>
                      <td className="px-3 py-2 border-b border-slate-200 whitespace-nowrap">
                        {p.category}
                      </td>
                      <td className="px-3 py-2 border-b border-slate-200">
                        <span className="text-[11px] text-slate-600">
                          {p.tags && p.tags.length > 0
                            ? p.tags.join(", ")
                            : "–"}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                        {String(p.id).length > 24
                          ? String(p.id).slice(0, 24) + "..."
                          : String(p.id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.products && data.products.length === 0 && !loading && (
            <p className="text-sm text-slate-500">
              Fuer diese Source wurden keine Produkte gefunden.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
