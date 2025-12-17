"use client";

/**
 * EFRO Demo-Landingpage
 * Route: /demo
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";

export default function DemoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl rounded-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg">
              <Play size={18} />
            </div>

            <CardTitle className="text-3xl font-bold mb-2">
              EFRO – Demo-Modus
            </CardTitle>

            <p className="text-gray-500">
              Testkatalog. Keine echten Bestellungen. Keine Änderungen an realen Shop-Daten.
            </p>
          </CardHeader>

          <CardContent>
            <p className="text-center text-gray-600 mb-5">
              Stell EFRO Fragen wie ein echter Kunde. EFRO antwortet, empfiehlt Produkte und zeigt sie direkt im Panel.
              Voice kann (je nach Setup) aktiviert sein.
            </p>

            <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-900">
              <div className="flex items-start gap-2">
                <ShieldCheck size={18} className="mt-0.5 text-indigo-700" />
                <div>
                  <div className="font-semibold">DSGVO-freundlich</div>
                  <div className="text-indigo-800/80">
                    Besucher starten die Interaktion per Klick auf „Start“.
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
             <Link
  href="/avatar-seller?shop=demo"
  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold py-6 shadow-lg hover:scale-[1.01] transition-transform text-lg inline-flex items-center justify-center"
>
  Starten
</Link>


              <Link
  href="/"
  className="w-full rounded-xl py-6 text-lg inline-flex items-center justify-center border border-input bg-background hover:bg-accent hover:text-accent-foreground"
>
  Zur Landing
</Link>

            </div>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Hinweis: Diese Demo nutzt einen Testkatalog. Es werden keine echten Bestellungen ausgelöst und keine realen Shop-Daten verändert.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
