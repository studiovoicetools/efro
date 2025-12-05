"use client";

/**
 * EFRO Demo-Landingpage im Onboarding-Stil (maximale Demo-Fläche)
 * Route: /demo
 */

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      {/* Header – angelehnt an Onboarding */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-300 font-bold text-xl">
            E
          </div>
          <div>
            <div className="text-sm font-semibold tracking-wide uppercase text-slate-300">
              EFRO · AVATAR DEMO
            </div>
            <div className="text-xs text-slate-400">
              Teste deinen 24/7 Avatar-Verkäufer live – ohne Setup.
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Demo <span className="font-semibold text-slate-200">Live</span>
        </div>
      </header>

      {/* Main – alles untereinander, Demo bekommt volle Breite */}
      <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-6xl mx-auto w-full space-y-6">
        {/* Info-Section */}
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 lg:p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.6)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <h1 className="text-lg font-semibold text-slate-100">
                  Dein 24/7 Avatar-Verkäufer für Shopify
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  EFRO berät Kunden, versteht Budget & Kategorien
                  und zeigt die passenden Produkte – wie ein echter Verkäufer.
                </p>
              </div>
              <span className="self-start text-[10px] uppercase tracking-wide text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-full px-2 py-1">
                Live Demo
              </span>
            </div>

            <div className="grid sm:grid-cols-4 gap-3 mt-2 text-[11px] text-slate-200">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-sm font-semibold mb-1">Mehr Umsatz</div>
                <p className="text-[11px] text-slate-400">
                  EFRO macht intelligente Produktempfehlungen und erhöht
                  den durchschnittlichen Warenkorbwert.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-sm font-semibold mb-1">24/7 verfügbar</div>
                <p className="text-[11px] text-slate-400">
                  Dein Avatar ist immer online – nachts, am Wochenende
                  und an Feiertagen.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-sm font-semibold mb-1">
                  Versteht Budget & Intent
                </div>
                <p className="text-[11px] text-slate-400">
                  EFRO erkennt Preisrahmen, Kategorien und Nutzung –
                  und filtert den Katalog entsprechend.
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                <div className="text-sm font-semibold mb-1">Kein Risiko</div>
                <p className="text-[11px] text-slate-400">
                  Diese Seite ist nur eine Demo – keine echten Bestellungen,
                  ideal für Tests & Screen-Recordings.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <h2 className="text-sm font-semibold text-slate-100 mb-1">
              So testest du EFRO
            </h2>
            <ul className="text-[11px] text-slate-300 space-y-1.5">
              <li>• Stelle Fragen wie ein echter Kunde („Ich suche ein Parfum unter 50 €“).</li>
              <li>• Teste Budget-Queries („Zeig mir Premium-Produkte“).</li>
              <li>• Frage nach Kategorien („Snowboard“, „Haushalt“, „Geschenke“).</li>
              <li>• Achte darauf, wie sich Empfehlungen und Antworten anpassen.</li>
            </ul>
          </div>
        </section>

        {/* Demo-Section – große Box, volle Breite */}
        <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4 lg:p-5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                EFRO Avatar-Seller Live
              </h2>
              <p className="text-xs text-slate-400">
                Stelle deine Fragen direkt an den Avatar – Mikrofon optional.
              </p>
            </div>
            <span className="text-[10px] text-slate-400">
              Demo-Shop: <span className="font-mono text-slate-100">demo</span>
            </span>
          </div>

          <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 h-[75vh] min-h-[540px] flex items-stretch justify-stretch overflow-hidden">
            <iframe
              src="/avatar-seller?shop=demo"
              className="w-full h-full border-0"
              title="EFRO Avatar-Seller Demo"
              allow="microphone"
            />
          </div>
        </section>

        {/* Nächster Schritt */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 lg:p-5 text-[11px] text-slate-400">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-100">
              Nächster Schritt
            </span>
            <span className="text-[10px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-full px-2 py-0.5">
              Onboarding
            </span>
          </div>
          <p>
            Wenn dir die Demo gefällt, kannst du im Onboarding deinen
            eigenen Avatar & deine Stimme auswählen und EFRO in deinem
            Shopify-Shop aktivieren.
          </p>
        </section>
      </main>
    </div>
  );
}




