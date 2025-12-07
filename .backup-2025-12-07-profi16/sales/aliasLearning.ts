// src/lib/sales/aliasLearning.ts

import { normalizeAliasKey } from "./aliasMap";

/**
 * Typ für AI-generierte Alias-Vorschläge
 */
export type LearnedAliasProposal = {
  term: string;
  normalizedTerm: string;
  type: "brand" | "category" | "usage" | "tag";
  mapToCategorySlug?: string;
  mapToTag?: string;
  mapToBrand?: string;
  confidence: number;
};

/**
 * Speichert einen gelernten Alias in aliases.de.dynamic.json
 * 
 * WICHTIG: Diese Funktion schreibt direkt in die Datei.
 * In Production sollte stattdessen Supabase verwendet werden.
 * 
 * @param proposal Der Alias-Vorschlag, der gespeichert werden soll
 * @returns true, wenn erfolgreich gespeichert, false bei Fehler
 */
export async function saveLearnedAliasToFile(
  proposal: LearnedAliasProposal
): Promise<boolean> {
  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    
    const filePath = path.join(process.cwd(), "src/lib/sales/aliases.de.dynamic.json");
    
    // Lade bestehende Datei
    let existingData: { _comment?: string; _version?: string; aliases: any[] } = {
      _comment: "Dynamisch gelernte Aliase (z. B. aus AI oder User-Feedback)",
      _version: "1.0.0",
      aliases: [],
    };
    
    try {
      const fileContent = await fs.readFile(filePath, "utf-8");
      existingData = JSON.parse(fileContent);
    } catch (err) {
      // Datei existiert nicht oder ist ungültig → verwende Default
      console.warn("[EFRO AliasLearning] Could not read existing dynamic aliases file", err);
    }
    
    // Prüfe, ob dieser Alias bereits existiert
    const normalizedTerm = proposal.normalizedTerm.toLowerCase().trim();
    const existingIndex = existingData.aliases.findIndex(
      (a: any) => a.normalizedTerm?.toLowerCase().trim() === normalizedTerm
    );
    
    if (existingIndex >= 0) {
      // Update bestehenden Eintrag, wenn Confidence höher ist
      const existing = existingData.aliases[existingIndex];
      if (proposal.confidence > (existing.confidence || 0)) {
        existingData.aliases[existingIndex] = {
          ...proposal,
          source: "ai",
        };
        console.log("[EFRO AliasLearning] Updated existing alias with higher confidence", {
          term: proposal.term,
          oldConfidence: existing.confidence,
          newConfidence: proposal.confidence,
        });
      } else {
        console.log("[EFRO AliasLearning] Alias already exists with higher or equal confidence", {
          term: proposal.term,
          existingConfidence: existing.confidence,
          newConfidence: proposal.confidence,
        });
        return false;
      }
    } else {
      // Neuer Eintrag
      existingData.aliases.push({
        ...proposal,
        source: "ai",
      });
      console.log("[EFRO AliasLearning] Added new learned alias", {
        term: proposal.term,
        normalizedTerm: proposal.normalizedTerm,
        type: proposal.type,
        confidence: proposal.confidence,
      });
    }
    
    // Sortiere Aliase nach Term (für bessere Lesbarkeit)
    existingData.aliases.sort((a: any, b: any) => {
      const termA = (a.term || "").toLowerCase();
      const termB = (b.term || "").toLowerCase();
      return termA.localeCompare(termB);
    });
    
    // Schreibe zurück
    await fs.writeFile(
      filePath,
      JSON.stringify(existingData, null, 2) + "\n",
      "utf-8"
    );
    
    console.log("[EFRO AliasLearning] Successfully saved learned alias to file", {
      term: proposal.term,
      filePath,
      totalAliases: existingData.aliases.length,
    });
    
    return true;
  } catch (err) {
    console.error("[EFRO AliasLearning] Error saving learned alias to file", err);
    return false;
  }
}

/**
 * Speichert einen gelernten Alias in Supabase (falls konfiguriert)
 * 
 * @param proposal Der Alias-Vorschlag, der gespeichert werden soll
 * @param shopDomain Optional: Shop-Domain für shop-spezifische Aliase
 * @returns true, wenn erfolgreich gespeichert, false bei Fehler oder wenn Supabase nicht konfiguriert ist
 */
export async function saveLearnedAliasToSupabase(
  proposal: LearnedAliasProposal,
  shopDomain?: string
): Promise<boolean> {
  try {
    const { getEfroSupabaseServerClient } = await import("@/lib/efro/supabaseServer");
    const supabase = getEfroSupabaseServerClient();
    
    if (!supabase) {
      console.log("[EFRO AliasLearning] Supabase not configured, skipping database save");
      return false;
    }
    
    // Prüfe, ob dieser Alias bereits existiert
    const normalizedTerm = normalizeAliasKey(proposal.term);
    let query = supabase
      .from("aliases_de")
      .select("*")
      .eq("normalized_term", normalizedTerm);
    
    if (shopDomain) {
      query = query.or(`shop_domain.eq.${shopDomain},shop_domain.is.null`);
    } else {
      query = query.is("shop_domain", null);
    }
    
    const { data: existing, error: selectError } = await query;
    
    if (selectError) {
      console.error("[EFRO AliasLearning] Supabase select error", selectError);
      return false;
    }
    
    // Wenn bereits vorhanden und Confidence nicht höher, überspringe
    if (existing && existing.length > 0) {
      const existingEntry = existing[0];
      if (existingEntry.confidence >= proposal.confidence) {
        console.log("[EFRO AliasLearning] Alias already exists with higher or equal confidence in Supabase", {
          term: proposal.term,
          existingConfidence: existingEntry.confidence,
          newConfidence: proposal.confidence,
        });
        return false;
      }
    }
    
    // Upsert: INSERT oder UPDATE
    const { error } = await supabase
      .from("aliases_de")
      .upsert(
        {
          term: proposal.term,
          normalized_term: normalizedTerm,
          type: proposal.type,
          map_to_category_slug: proposal.mapToCategorySlug || null,
          map_to_tag: proposal.mapToTag || null,
          map_to_brand: proposal.mapToBrand || null,
          confidence: proposal.confidence,
          source: "ai",
          shop_domain: shopDomain || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "normalized_term,shop_domain",
        }
      );
    
    if (error) {
      console.error("[EFRO AliasLearning] Supabase error", error);
      return false;
    }
    
    console.log("[EFRO AliasLearning] Successfully saved learned alias to Supabase", {
      term: proposal.term,
      shopDomain: shopDomain || "global",
    });
    
    return true;
  } catch (err) {
    console.error("[EFRO AliasLearning] Error saving learned alias to Supabase", err);
    return false;
  }
}

/**
 * Generiert Alias-Vorschläge basierend auf unbekannten Begriffen und Katalog-Metadaten
 * 
 * Diese Funktion simuliert eine LLM-Integration. Später kann hier eine echte LLM-API aufgerufen werden.
 * 
 * @param unknownTerms Liste von unbekannten Begriffen
 * @param catalogMeta Metadaten über den Katalog (Kategorien, etc.)
 * @returns Array von LearnedAliasProposal
 */
export function generateAliasProposals(
  unknownTerms: string[],
  catalogMeta?: {
    totalProducts?: number;
    categories?: string[];
  }
): LearnedAliasProposal[] {
  const proposals: LearnedAliasProposal[] = [];
  
  // Einfache Heuristik: Prüfe, ob unbekannte Begriffe zu Kategorien passen
  const categories = catalogMeta?.categories || [];
  const normalizedCategories = categories.map((c) => c.toLowerCase().trim());
  
  for (const term of unknownTerms) {
    if (!term || term.length < 3) continue;
    
    const normalizedTerm = term.toLowerCase().trim();
    
    // Prüfe, ob Term einer Kategorie ähnelt
    for (const category of normalizedCategories) {
      if (category.includes(normalizedTerm) || normalizedTerm.includes(category)) {
        proposals.push({
          term,
          normalizedTerm,
          type: "category",
          mapToCategorySlug: category,
          confidence: 0.85, // Hohe Confidence bei Kategorie-Match
        });
        break; // Nur einen Vorschlag pro Term
      }
    }
    
    // Weitere Heuristiken können hier hinzugefügt werden:
    // - Brand-Erkennung (z. B. "fressnapf" → brand)
    // - Usage-Erkennung (z. B. "reiniger" → usage)
    // - Tag-Erkennung (z. B. "hund" → tag)
  }
  
  return proposals;
}

