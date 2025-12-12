"use client";

/**
 * EFRO Demo-Landingpage
 * Route: /demo
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export default function DemoPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100 px-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold">
              EFRO – Demo-Modus
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-center text-gray-500 mb-4">
              Teste EFRO wie ein echter Kunde: Fragen stellen, Empfehlungen bekommen, Verkäufer-Feeling.
              Die Demo nutzt einen Testkatalog – keine echten Bestellungen, keine Änderungen an realen Shop-Daten.
            </p>

            <ul className="mb-6 space-y-2">
              <li className="flex items-start gap-2 text-gray-700 text-base">
                <span className="mt-1">•</span>
                <span>Intent & Budget erkennen</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 text-base">
                <span className="mt-1">•</span>
                <span>Passende Produkte im Panel anzeigen</span>
              </li>
              <li className="flex items-start gap-2 text-gray-700 text-base">
                <span className="mt-1">•</span>
                <span>Voice/Chat wie im Shop-Erlebnis</span>
              </li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                asChild
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold py-6 rounded-lg shadow-lg hover:scale-[1.02] transition-transform text-lg"
              >
                <Link href="/avatar-seller?shop=demo">
                  EFRO jetzt testen <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>

              <Button asChild variant="outline" className="w-full py-6 rounded-lg text-lg">
                <Link href="/">Zur Landing</Link>
              </Button>
            </div>

            <p className="mt-5 text-center text-xs text-gray-400">
              Demo-Hinweis: Testkatalog, keine echten Bestellungen, keine realen Shop-Daten.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
