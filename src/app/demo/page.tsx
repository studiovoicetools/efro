"use client";

/**
 * EFRO Demo-Landingpage
 * Route: /demo
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DemoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl rounded-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold mb-2">
              EFRO – Dein KI-Verkaufsavatar (Demo)
            </CardTitle>
            <p className="text-gray-500">
              Testkatalog. Keine echten Bestellungen. Keine Änderungen an realen Shop-Daten.
            </p>
          </CardHeader>

          <CardContent>
            <p className="text-center text-gray-600 mb-6">
              EFRO beantwortet Fragen deiner Kund:innen, findet passende Produkte aus dem Katalog
              und kann mit natürlicher Stimme sprechen – so, wie ein echter Profi-Seller.
            </p>

            <Link href="/avatar-seller?shop=demo" className="block w-full">
              <Button className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:scale-105 transition-transform text-lg">
                EFRO jetzt testen
              </Button>
            </Link>

            <p className="mt-6 text-xs text-gray-500 text-center">
              Demo-Hinweis: Diese Version nutzt einen Testkatalog. Es werden keine echten Bestellungen ausgelöst
              und keine realen Shop-Daten verändert.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
