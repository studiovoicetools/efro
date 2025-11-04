"use client";
import { fetchSupabaseProducts } from "@/app/lib/fetchSupabaseProducts";
import { ChatProductList } from "@/app/components/ChatProductList";

export async function handleProductQuery({
  rawUserText,
  onRenderMessage,
  voiceSummary,
}: {
  rawUserText: string;
  onRenderMessage: (jsx: JSX.Element) => void;
  voiceSummary?: (text: string) => void;
}) {
  console.log("🟢 handleProductQuery gestartet mit:", rawUserText);

  const q = extractQuery(rawUserText);
  console.log("🔍 Suchbegriff erkannt:", q);

  const { items } = await fetchSupabaseProducts({ q, limit: 8 });
  console.log("📦 Supabase-Daten empfangen:", items);

  if (!items || items.length === 0) {
    console.warn("⚠️ Keine Produkte gefunden für:", q);
  }

  // Nachricht rendern
  onRenderMessage(
    <div>
      <div className="mb-2 text-sm text-neutral-700">
        Ich habe {items.length} {q ? `Treffer für „${q}“` : "Produkte"} gefunden:
      </div>
      <ChatProductList items={items} />
    </div>
  );

  if (voiceSummary) {
    const speech = items.length
      ? `Ich habe ${items.length} ${q ? `Ergebnisse für ${q}` : "Produkte"} gefunden.`
      : `Ich habe leider keine passenden Produkte gefunden.`;
    console.log("🗣️ Sprachzusammenfassung:", speech);
    voiceSummary(speech);
  }
}

function extractQuery(input: string): string | undefined {
  const txt = input.toLowerCase();
  const m = txt.match(/(?:nach|für)\s+([a-z0-9\- _]+)/i);
  if (m?.[1]) return m[1].trim();

  if (txt.includes("hoodie")) return "hoodie";
  if (txt.includes("shirt")) return "shirt";
  if (txt.includes("cap")) return "cap";
  if (txt.includes("jacke")) return "jacke";
  if (txt.includes("mütze")) return "mütze";
  if (txt.includes("produkt")) return undefined;

  return undefined;
}
