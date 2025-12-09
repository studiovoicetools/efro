// src/app/api/sellerbrain-ai/route.ts

import { NextRequest, NextResponse } from "next/server";

// OpenAI-Import (nur wenn OPENAI_API_KEY vorhanden ist)
let OpenAI: any = null;
try {
  if (process.env.OPENAI_API_KEY) {
    OpenAI = require("openai").default;
  }
} catch (e) {
  // OpenAI-Package nicht installiert oder nicht verfügbar
  console.log("[EFRO AI-Resolver] OpenAI package not available");
}

type AiTrigger = {
  needsAiHelp: boolean;
  unknownTerms: string[];
  [key: string]: any;
};

type AiResolverRequest = {
  userText: string;
  aiTrigger: AiTrigger;
  categories?: string[];
  catalogKeywords?: string[];
};

type AiResolverResponse = {
  normalizedText: string;
  replacements: { from: string; to: string }[];
  explanation?: string;
};

/**
 * Debug-Korrekturen für häufige STT-Fehler
 * Wird vor dem LLM-Call angewendet, um häufige Fehler schnell zu korrigieren
 */
const DEBUG_CORRECTIONS: Array<{ from: RegExp; to: string }> = [
  { from: /gesichtscreen/gi, to: "Gesichtscreme" },
  { from: /gesichts\s+cremé/gi, to: "Gesichtscreme" },
  { from: /gesichts\s+creme/gi, to: "Gesichtscreme" },
  { from: /hund\s+futter/gi, to: "Hundefutter" },
  { from: /katzen\s+futter/gi, to: "Katzenfutter" },
];

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AiResolverRequest;

  const { userText, aiTrigger, categories, catalogKeywords } = body;

  // Wenn kein AI-Bedarf oder keine unknownTerms → direkt zurück
  if (!aiTrigger?.needsAiHelp || !aiTrigger.unknownTerms?.length) {
    const resp: AiResolverResponse = {
      normalizedText: userText,
      replacements: [],
      explanation: "no_ai_needed",
    };
    return NextResponse.json(resp);
  }

  // 🔹 Debug-Hack: Lokale Variablen für Text-Normalisierung
  const originalText: string = (body.userText ?? "").toString();
  let normalizedText: string = originalText;
  const replacements: { from: string; to: string }[] = [];

  // 🔹 Debug-Korrekturen: Wende alle Regeln aus DEBUG_CORRECTIONS an
  for (const correction of DEBUG_CORRECTIONS) {
    const matches = normalizedText.match(correction.from);
    if (matches && matches.length > 0) {
      // Extrahiere den tatsächlich gematchten Text (für replacements-Liste)
      const matchedText = matches[0];
      // Ersetze alle Vorkommen
      normalizedText = normalizedText.replace(correction.from, correction.to);
      // Füge Replacement hinzu (nur einmal pro Regel, auch wenn mehrfach gematcht)
      const alreadyAdded = replacements.some(
        (r) => r.from.toLowerCase() === matchedText.toLowerCase()
      );
      if (!alreadyAdded) {
        replacements.push({ from: matchedText, to: correction.to });
      }
    }
  }

  console.log("[EFRO AI-Resolver] Debug replacements", {
    originalText,
    normalizedText,
    replacements,
    rulesApplied: replacements.length,
  });

  // 🔹 Prüfe, ob OpenAI verfügbar ist
  if (!process.env.OPENAI_API_KEY || !OpenAI) {
    // Stub-Fallback: Nutze Debug-Hack-Ergebnisse
    const stubResponse: AiResolverResponse = {
      normalizedText,
      replacements,
      explanation: replacements.length
        ? "debug_rule_applied_no_openai_configured"
        : "stub_no_openai_configured",
    };
    return NextResponse.json(stubResponse);
  }

  // 🔹 LLM-Integration: Nur wenn OPENAI_API_KEY vorhanden ist
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `
Du bist ein AI-Resolver für einen digitalen Verkaufsberater (EFRO).

Du bekommst den vom Kunden gesprochenen Text (userText) und eine Liste unbekannter Begriffe (unknownTerms).

Deine Aufgabe: 
1. Korrigiere Tippfehler / STT-Fehler (z. B. "Gesichtscreen" -> "Gesichtscreme").
2. Erzeuge eine JSON-Antwort mit:
   - "normalizedText": der bereinigte, verständliche Text
   - "replacements": Liste aus { "from": string, "to": string }
   - "explanation": kurze Erklärung (z. B. warum du etwas korrigiert hast)

Gib ausschließlich ein JSON-Objekt zurück, keine weiteren Texte.
`;

    const userPrompt = JSON.stringify({
      userText: normalizedText, // Nutze bereits debug-bereinigten Text
      unknownTerms: body.aiTrigger?.unknownTerms ?? [],
      categories: categories ?? [],
      catalogKeywords: catalogKeywords?.slice(0, 50) ?? [],
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });

    // Safeguard: Fallback auf Debug-Daten, falls Parsing scheitert
    let aiResponse: AiResolverResponse;
    try {
      const raw = completion.choices[0]?.message?.content ?? "{}";
      aiResponse = JSON.parse(raw) as AiResolverResponse;

      // Validierung: Stelle sicher, dass normalizedText und replacements vorhanden sind
      if (!aiResponse.normalizedText) {
        aiResponse.normalizedText = normalizedText;
      }
      if (!Array.isArray(aiResponse.replacements)) {
        aiResponse.replacements = replacements;
      }

      // Merge: Kombiniere Debug-Replacements mit LLM-Replacements (keine Duplikate)
      const mergedReplacements = [...replacements];
      for (const llmReplacement of aiResponse.replacements) {
        const exists = mergedReplacements.some(
          (r) => r.from.toLowerCase() === llmReplacement.from.toLowerCase()
        );
        if (!exists) {
          mergedReplacements.push(llmReplacement);
        }
      }

      // Aktualisiere normalizedText: Wende alle Replacements an
      let finalNormalizedText = aiResponse.normalizedText;
      for (const replacement of mergedReplacements) {
        finalNormalizedText = finalNormalizedText.replace(
          new RegExp(replacement.from, "gi"),
          replacement.to
        );
      }

      aiResponse.normalizedText = finalNormalizedText;
      aiResponse.replacements = mergedReplacements;

      console.log("[EFRO AI-Resolver] LLM response", {
        originalText,
        llmNormalizedText: aiResponse.normalizedText,
        replacements: aiResponse.replacements,
        explanation: aiResponse.explanation,
      });

      return NextResponse.json(aiResponse);
    } catch (error) {
      console.error("[EFRO AI-Resolver] Parse error, using fallback", error);
      const fallbackResponse: AiResolverResponse = {
        normalizedText,
        replacements,
        explanation: "openai_parse_error_fallback_debug_used",
      };
      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error("[EFRO AI-Resolver] OpenAI API error, using fallback", error);
    // Fallback auf Debug-Daten bei API-Fehler
    const fallbackResponse: AiResolverResponse = {
      normalizedText,
      replacements,
      explanation: "openai_api_error_fallback_debug_used",
    };
    return NextResponse.json(fallbackResponse);
  }
}

export const dynamic = "force-dynamic";

