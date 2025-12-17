// src/app/api/efro/ai-unknown-terms/route.ts

import { NextRequest, NextResponse } from "next/server";
import type { SellerBrainAiTrigger } from "@/lib/sales/modules/aiTrigger";
import type { LearnedAliasProposal } from "@/lib/sales/aliasLearning";
import {
  generateAliasProposals,
  saveLearnedAliasToFile,
  saveLearnedAliasToSupabase,
} from "@/lib/sales/aliasLearning";
import { normalizeAliasKey } from "@/lib/sales/aliasMap";

interface AiUnknownTermsPayload {
  shopDomain?: string;
  userText: string;
  aiTrigger: SellerBrainAiTrigger;
  catalogMeta?: {
    totalProducts: number;
    categories?: string[];
  };
}

interface AiUnknownTermsResponse {
  ok: boolean;
  handled: boolean;
  proposals?: LearnedAliasProposal[];
  savedCount?: number;
}

// 🧠 In-Memory-Cache für AI-Unknown-Terms (pro Node-Prozess)
const aiUnknownTermsCache = new Map<string, LearnedAliasProposal[]>();

/**
 * POST /api/efro/ai-unknown-terms
 * 
 * Empfängt unbekannte Begriffe aus SellerBrain, generiert Alias-Vorschläge
 * und speichert Vorschläge mit confidence >= 0.8 automatisch.
 * 
 * Body:
 * {
 *   shopDomain?: string;
 *   userText: string;
 *   aiTrigger: SellerBrainAiTrigger;
 *   catalogMeta?: { totalProducts: number; categories?: string[]; };
 * }
 * 
 * Response:
 * {
 *   ok: boolean;
 *   handled: boolean;
 *   proposals?: LearnedAliasProposal[];
 *   savedCount?: number;
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AiUnknownTermsPayload;

    const { shopDomain, userText, aiTrigger, catalogMeta } = body;

    if (!userText || typeof userText !== "string") {
      return NextResponse.json(
        { error: "Field 'userText' is required and must be a string." },
        { status: 400 }
      );
    }

    if (!aiTrigger || typeof aiTrigger.needsAiHelp !== "boolean") {
      return NextResponse.json(
        { error: "Field 'aiTrigger' is required and must be a valid SellerBrainAiTrigger." },
        { status: 400 }
      );
    }

    const unknownTerms = aiTrigger.unknownTerms || [];
    
    // 🧠 Cache-Key berechnen
    const shopKey = shopDomain ?? "default-shop";
    const textKey = normalizeAliasKey(userText);
    const cacheKey = `${shopKey}::${textKey}`;
    
    console.log("[EFRO AI-UnknownTerms]", {
      shopDomain: shopDomain ?? "local-dev",
      userText: userText.substring(0, 200), // Begrenze auf 200 Zeichen für Logs
      aiTrigger: {
        needsAiHelp: aiTrigger.needsAiHelp,
        reason: aiTrigger.reason,
        unknownTerms: unknownTerms.slice(0, 20), // Nur erste 20 für Logs
        unknownTermsCount: unknownTerms.length,
        codeTerm: aiTrigger.codeTerm,
      },
      catalogMeta: catalogMeta ?? null,
      timestamp: new Date().toISOString(),
    });

    // 🧠 Cache-Hit: Wenn wir für diese Kombination schon AI-Ergebnisse haben,
    // verwende sie und überspringe den AI-Call.
    let proposals: LearnedAliasProposal[] | null = null;
    const cached = aiUnknownTermsCache.get(cacheKey);
    if (cached) {
      console.log("[EFRO AI-UnknownTerms] Cache-Hit für", cacheKey, "→ benutze gespeicherte Proposals");
      proposals = cached;
    } else {
      console.log("[EFRO AI-UnknownTerms] Cache-Miss für", cacheKey, "→ rufe generateAliasProposals auf");
      proposals = generateAliasProposals(unknownTerms, catalogMeta);

      // Nur dann cachen, wenn wir ein gültiges Array haben (auch leere Arrays cachen, um Doppelaufrufe zu vermeiden)
      if (Array.isArray(proposals)) {
        aiUnknownTermsCache.set(cacheKey, proposals);
      }
    }

    // Sicherstellen, dass proposals mindestens ein leeres Array ist
    proposals = proposals ?? [];
    
    console.log("[EFRO AI-UnknownTerms] Generated proposals", {
      unknownTermsCount: unknownTerms.length,
      proposalsCount: proposals.length,
      proposals: proposals.map((p) => ({
        term: p.term,
        type: p.type,
        confidence: p.confidence,
      })),
    });

    // Speichere Vorschläge mit confidence >= 0.8 automatisch
    let savedCount = 0;
    const savedProposals: LearnedAliasProposal[] = [];
    
    for (const proposal of proposals) {
      if (proposal.confidence >= 0.8) {
        // Normalisiere den Term für konsistente Speicherung
        const normalizedProposal: LearnedAliasProposal = {
          ...proposal,
          normalizedTerm: normalizeAliasKey(proposal.term),
        };
        
        // Versuche zuerst Supabase (falls konfiguriert), sonst Datei
        const savedToSupabase = await saveLearnedAliasToSupabase(
          normalizedProposal,
          shopDomain
        );
        
        if (!savedToSupabase) {
          // Fallback: Speichere in Datei
          const savedToFile = await saveLearnedAliasToFile(normalizedProposal);
          if (savedToFile) {
            savedCount++;
            savedProposals.push(normalizedProposal);
          }
        } else {
          savedCount++;
          savedProposals.push(normalizedProposal);
        }
      }
    }
    
    if (savedCount > 0) {
      console.log("[EFRO AI-UnknownTerms] Auto-saved learned aliases", {
        savedCount,
        savedProposals: savedProposals.map((p) => ({
          term: p.term,
          type: p.type,
          confidence: p.confidence,
        })),
      });
    }

    const response: AiUnknownTermsResponse = {
      ok: true,
      handled: true,
      proposals,
      savedCount,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    console.error("[EFRO AI-UnknownTerms] Error processing request", err);
    return NextResponse.json(
      { error: "Internal server error", details: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

