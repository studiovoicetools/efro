"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };
type Cta = { label: string; href: string };

const STORAGE_KEY = "efro_landing_chat_v1";
const CONSENT_KEY = "efro_landing_consent_v1";

function loadHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Msg[];
    return [];
  } catch {
    return [];
  }
}

function saveHistory(history: Msg[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-50)));
  } catch {}
}

function loadConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

function saveConsent(v: boolean) {
  try {
    localStorage.setItem(CONSENT_KEY, v ? "1" : "0");
  } catch {}
}

export default function EfroSalesWidget() {
  const pathname = usePathname();

  // In der echten Demo-Route nicht drüberlegen (EFRO existiert dort schon als Produkt)
  const shouldHideOnThisRoute = useMemo(() => {
    return pathname?.startsWith("/avatar-seller");
  }, [pathname]);

  const [open, setOpen] = useState(true);
  const [minimized, setMinimized] = useState(false);

  const [consent, setConsent] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const [ctas, setCtas] = useState<Cta[]>([
    { label: "Demo-Shop testen (45 Produkte)", href: "/avatar-seller?shop=demo" },
    { label: "Installation ansehen", href: "/efro/onboarding" },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    setConsent(loadConsent());

    // Wenn noch keine Historie, initialer Pitch (aber erst nach Consent sichtbar „aktiv“)
    if (h.length === 0) {
      const seed: Msg[] = [
        {
          role: "assistant",
          content:
            "Ich bin EFRO – dein Profi-Seller als Avatar. Ich verkaufe in deinem Shop, beantworte Fragen und optimiere deinen Katalog.\n\nKlick auf „Start“, dann zeige ich dir live, wie ich Kunden überzeugend zur passenden Auswahl führe.",
        },
      ];
      setHistory(seed);
      saveHistory(seed);
    }
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history, open, minimized]);

  async function sendMessage(text: string) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    const nextHistory: Msg[] = [...history, { role: "user", content: trimmed }];
    setHistory(nextHistory);
    saveHistory(nextHistory);

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/landing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history: nextHistory }),
      });

      const data = (await res.json()) as {
        reply?: string;
        ctas?: Cta[];
        quickReplies?: string[];
      };

      const replyText =
        (data?.reply || "").trim() ||
        "Alles klar. Sag mir kurz: Was verkaufst du und welche Preisspanne?";
      const newCtas = Array.isArray(data?.ctas) ? data.ctas : [];

      const updated: Msg[] = [...nextHistory, { role: "assistant", content: replyText }];
      setHistory(updated);
      saveHistory(updated);

      if (newCtas.length) setCtas(newCtas);
    } catch {
      const updated: Msg[] = [
        ...nextHistory,
        { role: "assistant", content: "Ups – ich konnte gerade nicht antworten. Versuch’s bitte nochmal." },
      ];
      setHistory(updated);
      saveHistory(updated);
    } finally {
      setLoading(false);
    }
  }

  function startEfro() {
    setConsent(true);
    saveConsent(true);

    // Nach Start sofort ein starker erster Schritt:
    const hasAsked = history.some((m) => m.role === "assistant" && m.content.includes("Was verkaufst du"));
    if (!hasAsked) {
      const updated: Msg[] = [
        ...history,
        {
          role: "assistant",
          content:
            "Top. Damit ich dich sofort wie ein Profi verkaufe: Was verkaufst du (Kategorie) und welche Preisspanne ist typisch (z. B. 20–80€)?",
        },
      ];
      setHistory(updated);
      saveHistory(updated);
    }
  }

  if (!open) return null;

  if (shouldHideOnThisRoute) {
    // Statt Overlay: Mini-Hinweis mit Link, damit „weitermachen“ logisch bleibt.
    return (
      <div className="fixed bottom-4 right-4 z-[9999] w-[260px]">
        <div className="rounded-2xl border bg-white/95 shadow-xl p-3">
          <div className="text-sm font-semibold text-gray-900">EFRO läuft hier bereits im Demo-Modus.</div>
          <div className="text-xs text-gray-600 mt-1">
            Tipp: Teste die 45 Produkte im Demo-Shop. Für Installation & Early Access komm zurück zur Landing.
          </div>
          <div className="mt-2 flex gap-2">
            <Link
              href="/"
              className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 text-center"
            >
              Zur Landing
            </Link>
            <Link
              href="/avatar-seller?shop=demo"
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-2 text-xs font-semibold text-white text-center shadow-lg"
            >
              Demo-Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[360px] max-w-[calc(100vw-2rem)]">
      <div className="rounded-3xl border bg-white/95 shadow-2xl backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 shadow-lg" />
            <div className="leading-tight">
              <div className="text-sm font-extrabold text-gray-900">EFRO</div>
              <div className="text-[11px] text-gray-500">Profi-Seller • Chat (DSGVO-Start)</div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setMinimized((v) => !v)}
              className="rounded-xl border px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              title={minimized ? "Öffnen" : "Minimieren"}
            >
              {minimized ? "Öffnen" : "—"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              title="Schließen"
            >
              ✕
            </button>
          </div>
        </div>

        {minimized ? (
          <div className="px-4 pb-4">
            <div className="text-sm text-gray-700">
              {consent ? "Frag mich etwas – ich verkaufe wie ein Profi." : "Klick auf Start, dann geht’s los."}
            </div>
            <div className="mt-3 flex gap-2">
              {!consent ? (
                <button
                  onClick={startEfro}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-2 text-sm font-bold text-white shadow-lg"
                >
                  Start (DSGVO)
                </button>
              ) : (
                <button
                  onClick={() => setMinimized(false)}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-2 text-sm font-bold text-white shadow-lg"
                >
                  Chat öffnen
                </button>
              )}

              <Link
                href="/avatar-seller?shop=demo"
                className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold text-gray-900 hover:bg-gray-50 text-center"
              >
                Demo-Shop
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Consent */}
            {!consent && (
              <div className="px-4 pb-3">
                <div className="rounded-2xl border bg-indigo-50/70 p-3">
                  <div className="text-xs font-semibold text-indigo-900">DSGVO-Start erforderlich</div>
                  <div className="mt-1 text-xs text-indigo-900/80">
                    Ich starte erst nach deinem Klick. Keine Auto-Audio/Auto-Interaktion.
                  </div>
                  <button
                    onClick={startEfro}
                    className="mt-2 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-3 py-2 text-sm font-extrabold text-white shadow-lg"
                  >
                    Start (DSGVO)
                  </button>
                </div>
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              className="px-4 pb-3 max-h-[360px] overflow-auto space-y-2"
            >
              {history.map((m, idx) => (
                <div
                  key={idx}
                  className={`rounded-2xl px-3 py-2 text-sm leading-snug ${
                    m.role === "assistant"
                      ? "bg-gray-50 text-gray-900 border"
                      : "bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow"
                  }`}
                >
                  {m.content.split("\n").map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              ))}
              {loading && (
                <div className="rounded-2xl border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  EFRO denkt…
                </div>
              )}
            </div>

            {/* CTAs */}
            <div className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {ctas.slice(0, 3).map((c) => (
                  <Link
                    key={c.href + c.label}
                    href={c.href}
                    className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                  >
                    {c.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="px-4 pb-4">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!consent) return;
                  void sendMessage(input);
                }}
                className="flex gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={!consent || loading}
                  placeholder={consent ? "Frage stellen… (z. B. Installation, Preise, Katalog-Scan)" : "Bitte zuerst Start klicken"}
                  className="flex-1 rounded-2xl border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  type="submit"
                  disabled={!consent || loading || !input.trim()}
                  className="rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-2 text-sm font-extrabold text-white shadow-lg disabled:opacity-50"
                >
                  Senden
                </button>
              </form>

              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => consent && sendMessage("Wie läuft die Installation?")}
                  disabled={!consent || loading}
                  className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                >
                  Installation
                </button>
                <button
                  onClick={() => consent && sendMessage("Demo-Shop testen (45 Produkte)")}
                  disabled={!consent || loading}
                  className="flex-1 rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                >
                  Demo
                </button>
                <button
                  onClick={() => {
                    try {
                      localStorage.removeItem(STORAGE_KEY);
                      const seed: Msg[] = [
                        {
                          role: "assistant",
                          content:
                            "Reset ✅\nIch bin EFRO – dein Profi-Seller als Avatar. Klick auf „Start“, dann zeige ich dir live, wie ich Kunden überzeugend zur passenden Auswahl führe.",
                        },
                      ];
                      setHistory(seed);
                      saveHistory(seed);
                    } catch {}
                  }}
                  className="rounded-xl border px-3 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
