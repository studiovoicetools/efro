/**
 * EFRO: Lädt persistente LanguageRules aus Supabase in den Memory-Cache
 * 
 * Diese Funktion sollte beim Start der Anwendung oder in einem Background-Job
 * aufgerufen werden, um persistente LanguageRules in den Memory-Cache zu laden.
 * 
 * Da runSellerBrain synchron ist, werden die Supabase-Aufrufe hier gemacht
 * und die Ergebnisse in den Memory-basierten DynamicSynonyms-Cache geladen.
 */

import { supabase } from "../supabaseClient";
import { registerDynamicSynonym } from "./languageRules.de";
import type { LanguageRule } from "./types";

/**
 * Lädt alle persistente LanguageRules aus Supabase und registriert sie im Memory-Cache
 */
export async function loadLanguageRulesFromSupabase(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("language_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[EFRO LoadLanguageRules] Error loading from Supabase", {
        error: error.message,
      });
      return 0;
    }

    if (!data || data.length === 0) {
      console.log("[EFRO LoadLanguageRules] No language rules found in Supabase");
      return 0;
    }

    let loadedCount = 0;
    for (const row of data) {
      // Konvertiere Supabase-Row zu DynamicSynonymEntry
      registerDynamicSynonym({
        term: row.term,
        canonicalCategory: row.canonical ?? undefined,
        canonical: row.canonical ?? undefined,
        extraKeywords: row.keywords ?? undefined,
        keywords: row.keywords ?? undefined,
        categoryHints: row.category_hints ?? undefined,
      });
      loadedCount++;
    }

    console.log("[EFRO LoadLanguageRules] Loaded language rules from Supabase", {
      count: loadedCount,
      sampleTerms: data.slice(0, 5).map((r) => r.term),
    });

    return loadedCount;
  } catch (err) {
    console.error("[EFRO LoadLanguageRules] Exception loading from Supabase", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}











