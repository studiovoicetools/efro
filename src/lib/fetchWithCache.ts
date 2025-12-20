import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function fetchWithCache(
  shopDomain: string,
  query: string,
  generator: () => Promise<string>
): Promise<string> {
  // 1ï¸âƒ£ PrÃ¼fen, ob Antwort im Cache liegt
  const { data } = await supabase
    .from("cache_responses")
    .select("response")
    .eq("shop_domain", shopDomain)
    .eq("query", query)
    .maybeSingle();

  if (data?.response) {
    console.log("âš¡ Cache-Treffer fÃ¼r:", query);
    return data.response;
  }

  // 2ï¸âƒ£ Falls nicht vorhanden â†’ Generator ausfÃ¼hren (z. B. OpenAI- oder ElevenLabs-API)
  const fresh = await generator();

  // 3ï¸âƒ£ Ergebnis speichern
  await supabase.from("cache_responses").upsert({
    shop_domain: shopDomain,
    query,
    response: fresh,
  });

  console.log("ğŸ’¾ Cache-gespeichert:", query);
  return fresh;
}
