import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * LÃ¶scht alte, ungenutzte Cache-EintrÃ¤ge aus Supabase.
 *  - Nur audio-cache
 *  - Ã¤lter als 30 Tage
 *  - nicht als "protected" markiert
 */
export async function cleanupCache() {
  console.log("ğŸ§¹ Starte Cache-Bereinigungâ€¦");

  const { data, error } = await supabase
    .from("cache_audio")
    .select("id, audio_url, created_at, last_used, protected")
    .lte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .eq("protected", false);

  if (error) {
    console.error("âŒ Fehler beim Abrufen alter Caches:", error);
    return;
  }

  if (!data?.length) {
    console.log("âœ… Kein alter Cache zum LÃ¶schen gefunden.");
    return;
  }

  for (const row of data) {
    try {
      // Datei im Storage lÃ¶schen
      const path = row.audio_url.split("/storage/v1/object/public/")[1];
      await supabase.storage.from("public").remove([path]);
      await supabase.from("cache_audio").delete().eq("id", row.id);
      console.log(`ğŸ—‘ï¸ GelÃ¶scht: ${row.audio_url}`);
    } catch (err) {
      console.error("âš ï¸ Fehler beim LÃ¶schen:", err);
    }
  }

  console.log("âœ… Cache-Bereinigung abgeschlossen!");
}
// Automatische AusfÃ¼hrung, wenn Render-Cron oder Server startet
if (process.env.AUTO_CLEANUP === "true") {
  cleanupCache().then(() => {
    console.log("ğŸ§¹ Cache-Cleanup automatisch ausgefÃ¼hrt.");
  });
}
