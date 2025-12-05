/**
 * EFRO Dynamic Language Rules - Supabase Integration
 * 
 * Persistente Speicherung und Laden von dynamisch gelernten Sprachregeln.
 * 
 * SQL-VORSCHLAG (für Supabase):
 * 
 * create table if not exists language_rules (
 *   id uuid primary key default gen_random_uuid(),
 *   term text not null,
 *   locale text not null,
 *   canonical text,
 *   keywords text[],
 *   category_hints text[],
 *   source text not null default 'dynamic',
 *   created_at timestamptz not null default now(),
 *   updated_at timestamptz not null default now(),
 *   unique(term, locale)
 * );
 * 
 * create index if not exists idx_language_rules_term_locale on language_rules(term, locale);
 */

import { supabase } from "../supabaseClient";
import type { LanguageRule } from "./types";

/**
 * Normalisiert einen Begriff für die Suche
 */
function normalizeTerm(term: string): string {
  return term.toLowerCase().trim();
}

/**
 * Lädt eine dynamische Sprachregel aus Supabase
 */
export async function loadDynamicLanguageRule(
  term: string,
  locale: string
): Promise<LanguageRule | null> {
  const normalized = normalizeTerm(term);
  
  try {
    const { data, error } = await supabase
      .from("language_rules")
      .select("*")
      .eq("term", normalized)
      .eq("locale", locale)
      .limit(1)
      .single();

    if (error) {
      // Wenn kein Eintrag gefunden wurde, ist das OK
      if (error.code === "PGRST116") {
        return null;
      }
      console.warn("[EFRO DynamicLanguageRules] Error loading rule", {
        term: normalized,
        locale,
        error: error.message,
      });
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      term: data.term,
      locale: data.locale,
      canonical: data.canonical ?? undefined,
      keywords: data.keywords ?? undefined,
      categoryHints: data.category_hints ?? undefined,
      source: (data.source as "dynamic" | "ai") ?? "dynamic",
    };
  } catch (err) {
    console.warn("[EFRO DynamicLanguageRules] Exception loading rule", {
      term: normalized,
      locale,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Speichert eine dynamische Sprachregel in Supabase
 */
export async function saveDynamicLanguageRule(
  rule: LanguageRule
): Promise<void> {
  const normalized = normalizeTerm(rule.term);
  
  try {
    // Prüfe, ob bereits ein Eintrag existiert
    const existing = await loadDynamicLanguageRule(normalized, rule.locale);
    
    const ruleData = {
      term: normalized,
      locale: rule.locale,
      canonical: rule.canonical ?? null,
      keywords: rule.keywords ?? null,
      category_hints: rule.categoryHints ?? null,
      source: rule.source,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update
      const { error } = await supabase
        .from("language_rules")
        .update(ruleData)
        .eq("term", normalized)
        .eq("locale", rule.locale);

      if (error) {
        console.error("[EFRO DynamicLanguageRules] Error updating rule", {
          term: normalized,
          locale: rule.locale,
          error: error.message,
        });
        throw error;
      }
    } else {
      // Insert
      const { error } = await supabase
        .from("language_rules")
        .insert(ruleData);

      if (error) {
        console.error("[EFRO DynamicLanguageRules] Error inserting rule", {
          term: normalized,
          locale: rule.locale,
          error: error.message,
        });
        throw error;
      }
    }

    console.log("[EFRO DynamicLanguageRules] Saved dynamic rule", {
      term: normalized,
      locale: rule.locale,
      canonical: rule.canonical,
      keywordsCount: rule.keywords?.length ?? 0,
      categoryHintsCount: rule.categoryHints?.length ?? 0,
      source: rule.source,
    });
  } catch (err) {
    console.error("[EFRO DynamicLanguageRules] Exception saving rule", {
      term: normalized,
      locale: rule.locale,
      error: err instanceof Error ? err.message : String(err),
    });
    // Nicht werfen, damit sellerBrain weiterlaufen kann, auch wenn Supabase ausfällt
  }
}








