"use client";

/**
 * EFRO Demo-Landingpage
 * Route: /demo
 */

export default function DemoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="max-w-xl w-full space-y-6 text-center">
        <h1 className="text-3xl font-semibold text-white">
          EFRO – Dein KI-Verkaufsavatar im Demo-Modus
        </h1>
        <p className="text-slate-300">
          EFRO beantwortet Fragen deiner Kund:innen, findet passende Produkte aus dem Katalog
          und kann mit natürlicher Stimme sprechen – so, wie ein echter Profiseller.
        </p>

        <div className="mt-4">
          <a
            href="/avatar-seller?shop=demo"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-base font-medium bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition"
          >
            EFRO jetzt testen
          </a>
        </div>

        <p className="text-xs text-slate-400">
          Demo-Hinweis: Diese Version nutzt einen Testkatalog. Es werden keine echten Bestellungen ausgelöst
          und keine realen Shop-Daten verändert.
        </p>
      </div>
    </main>
  );
}







