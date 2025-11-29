"use client";

import React, { useCallback, useEffect, useState } from "react";

type EfroEvent = {
  id: string;
  shopDomain: string | null;
  userText: string | null;
  intent: string | null;
  productCount: number | null;
  plan: string | null;
  hadError: boolean | null;
  errorMessage: string | null;
  createdAt: string;
};

const LIMIT_OPTIONS = [50, 100, 200];

export default function EfroEventsAdminPage() {
  const [events, setEvents] = useState<EfroEvent[]>([]);
  const [shopDomain, setShopDomain] = useState("");
  const [limit, setLimit] = useState<number>(50);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    const trimmedShop = shopDomain.trim();
    if (trimmedShop) {
      params.set("shopDomain", trimmedShop);
    }

    const url = `/api/efro/events?${params.toString()}`;
    console.log("[EfroEventsAdmin] Loading events", {
      shopDomainFilter: trimmedShop || "(empty - no filter)",
      limit,
      url,
    });

    try {
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const json = await res.json();

      console.log("[EfroEventsAdmin] API JSON", json);
      console.log("[EfroEventsAdmin] Raw response structure", {
        hasEvents: "events" in json,
        eventsType: Array.isArray(json.events) ? "array" : typeof json.events,
        eventsLength: Array.isArray(json.events) ? json.events.length : "N/A",
        disabled: json.disabled,
      });

      const eventsArray: EfroEvent[] = Array.isArray(json.events)
        ? json.events
        : [];

      // Sortiere Events nach createdAt absteigend (neueste zuerst)
      const sortedEvents = [...eventsArray].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA; // absteigend
      });

      console.log("[EfroEventsAdmin] Parsed events", {
        count: sortedEvents.length,
        sample: sortedEvents.slice(0, 3).map((e) => ({
          id: e.id,
          shopDomain: e.shopDomain,
          userText: e.userText?.substring(0, 30),
          intent: e.intent,
          createdAt: e.createdAt,
        })),
      });

      setEvents(sortedEvents);
    } catch (err: any) {
      console.error("[EfroEventsAdmin] Error loading events", err);
      setError(err?.message ? String(err.message) : "Unbekannter Fehler");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [limit, shopDomain]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">
          EFRO – Event Logs
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Letzte Events aus EFRO (nur lesend).
        </p>

        {/* Filter- und Control-Leiste */}
        <div className="mt-8 rounded-xl bg-slate-900/80 p-4 ring-1 ring-slate-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400">
                Shop Domain (optional)
              </label>
              <input
                type="text"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                placeholder="z. B. test-shop.myshopify.com oder local-dev"
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400">
                Limit
              </label>
              <select
                className="mt-1 w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
              >
                {LIMIT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadEvents()}
              className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 shadow-sm hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
            >
              Neu laden
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-red-500/40 bg-red-900/30 px-3 py-2 text-sm text-red-200">
              Fehler beim Laden der Events: {error}
            </div>
          )}
        </div>

        {/* Tabelle */}
        <div className="mt-6 overflow-hidden rounded-xl bg-slate-900/80 ring-1 ring-slate-800">
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-900/90 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Zeit</th>
                  <th className="px-4 py-3">Shop</th>
                  <th className="px-4 py-3">Intent</th>
                  <th className="px-4 py-3">Products</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Error?</th>
                  <th className="px-4 py-3">Error Message</th>
                  <th className="px-4 py-3">User Text</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {isLoading && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-sm text-slate-400"
                    >
                      Lade Events …
                    </td>
                  </tr>
                )}

                {!isLoading && events.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-6 text-center text-sm text-slate-400"
                    >
                      Keine Events gefunden.
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  events.map((ev) => {
                    let localTime = "-";
                    let dateTime: Date | null = null;
                    
                    if (ev.createdAt) {
                      try {
                        dateTime = new Date(ev.createdAt);
                        if (!isNaN(dateTime.getTime())) {
                          // Format: DD.MM.YYYY, HH:MM:SS
                          localTime = dateTime.toLocaleString("de-DE", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          });
                        }
                      } catch (err) {
                        console.warn("[EfroEventsAdmin] Invalid date", ev.createdAt, err);
                      }
                    }
                    
                    return (
                      <tr
                        key={ev.id}
                        className="hover:bg-slate-800/60 transition-colors"
                      >
                        <td className="px-4 py-2 align-top text-xs text-slate-300">
                          <span title={ev.createdAt || "Kein Datum"}>{localTime}</span>
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-200">
                          {ev.shopDomain || "-"}
                        </td>
                        <td className="px-4 py-2 align-top text-xs">
                          {ev.intent ? (
                            <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                              {ev.intent}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-200">
                          {ev.productCount ?? "-"}
                        </td>
                        <td className="px-4 py-2 align-top text-xs">
                          {ev.plan ? (
                            <span className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-sky-300">
                              {ev.plan}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-xs">
                          {ev.hadError ? (
                            <span className="inline-flex rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-300">
                              Ja
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                              Nein
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-300">
                          {ev.errorMessage
                            ? ev.errorMessage.length > 50
                              ? ev.errorMessage.slice(0, 50) + "…"
                              : ev.errorMessage
                            : "-"}
                        </td>
                        <td className="px-4 py-2 align-top text-xs text-slate-200">
                          {ev.userText
                            ? ev.userText.length > 80
                              ? ev.userText.slice(0, 80) + "…"
                              : ev.userText
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
