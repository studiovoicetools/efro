import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-center text-3xl font-bold mb-2">
              EFRO verkauft in deinem Shopify-Shop – wie ein Profi.
            </CardTitle>
          </CardHeader>

          <CardContent>
            <p className="text-center text-gray-500 mb-4">
              Avatar + Voice + Chat. Empfehlungen nach Intent, Budget und Kategorie. Nach Installation scannt EFRO deinen Katalog und schlägt bessere Titel, Tags und Beschreibungen vor.
            </p>

            <ul className="mb-6 space-y-2">
              <li className="flex items-center gap-2 text-gray-700 text-base">
                <span>•</span>
                <span>Versteht Kunden-Intent in Sekunden</span>
              </li>
              <li className="flex items-center gap-2 text-gray-700 text-base">
                <span>•</span>
                <span>Zeigt passende Produkte sofort im Panel</span>
              </li>
              <li className="flex items-center gap-2 text-gray-700 text-base">
                <span>•</span>
                <span>Findet Optimierungs-Potenzial im Katalog</span>
              </li>
            </ul>

            <div className="flex justify-center gap-4">
              <Button
                asChild
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:scale-105 transition-transform text-lg"
              >
                <Link href="/demo">Demo testen</Link>
              </Button>

              {/* TODO: Link-Ziel ggf. anpassen */}
              <Button
                asChild
                variant="outline"
                className="w-full text-indigo-600 font-semibold hover:underline text-lg"
              >
                <Link href="/efro/onboarding">In Shopify installieren</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
