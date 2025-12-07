# EFRO Dynamic Language Rules - Integration Guide

## Übersicht

Dieses System ermöglicht es, unbekannte Begriffe (z. B. "Fressnapf") **genau einmal** per AI zu klären und das Ergebnis persistent zu speichern. Ab dann wird derselbe Begriff ohne erneute AI-Anfrage verarbeitet.

## Architektur

### 1. Typen (`src/lib/sales/types.ts`)

- `LanguageRule`: Einheitlicher Typ für statische und dynamische Sprachregeln
- `LanguageRuleAiResponse`: Struktur für AI-Antworten

### 2. Supabase-Integration (`src/lib/sales/dynamicLanguageRules.ts`)

- `loadDynamicLanguageRule(term, locale)`: Lädt eine persistente Regel aus Supabase
- `saveDynamicLanguageRule(rule)`: Speichert eine Regel in Supabase

**SQL-Schema (für Supabase):**
```sql
create table if not exists language_rules (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  locale text not null,
  canonical text,
  keywords text[],
  category_hints text[],
  source text not null default 'dynamic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(term, locale)
);

create index if not exists idx_language_rules_term_locale on language_rules(term, locale);
```

### 3. Resolution (`src/lib/sales/resolveLanguageRule.ts`)

- `resolveTermWithLanguageRules(term, locale, cache)`: Resolved einen Begriff über static → dynamic → AI
- `registerLanguageRuleFromAi(term, locale, aiResponse)`: Registriert eine AI-Antwort als LanguageRule

### 4. Memory-Cache (`src/lib/sales/languageRules.de.ts`)

- `DynamicSynonymEntry`: Erweitert um `canonical`, `keywords`, `categoryHints`
- `registerDynamicSynonym()`: Registriert eine Regel im Memory-Cache
- `getDynamicSynonyms()`: Gibt alle Memory-basierten Regeln zurück

### 5. Integration in sellerBrain

- **Keyword-Matching**: LanguageRule-Keywords werden in `expandedWords` integriert
- **Category-Matching**: `categoryHints` geben Bonuspunkte beim Scoring
- **Core-Match**: LanguageRule-Keywords werden beim Core-Matching berücksichtigt

## Workflow

### Szenario: "Fressnapf" wird zum ersten Mal verwendet

1. **User-Query**: "Ich suche einen Fressnapf für meinen Hund"
2. **sellerBrain** erkennt "fressnapf" als unbekannten Begriff
3. **AI-Trigger** wird gesetzt: `reason: "synonym_lookup"`, `unknownTerms: ["fressnapf"]`
4. **Externe AI-Schicht** (z. B. ElevenLabs/OpenAI) verarbeitet den Trigger
5. **AI-Antwort** wird über `registerLanguageRuleFromAi()` registriert:
   ```typescript
   await registerLanguageRuleFromAi("fressnapf", "de", {
     canonical: "napf",
     keywords: ["fressnapf", "futternapf", "haustier napf", "hundenapf", "katzen napf"],
     categoryHints: ["pets", "dogs", "cats", "accessories"]
   });
   ```
6. **Regel wird gespeichert**:
   - In Supabase (persistent)
   - Im Memory-Cache (für sofortige Nutzung)

### Szenario: "Fressnapf" wird zum zweiten Mal verwendet

1. **User-Query**: "Hast du Fressnapf-Produkte?"
2. **sellerBrain** erkennt "fressnapf"
3. **Memory-Cache** enthält bereits die Regel (aus vorherigem Request oder beim Start geladen)
4. **Kein AI-Trigger** mehr nötig
5. **Produkt-Scoring** nutzt `keywords` und `categoryHints` für besseres Matching

## Initialisierung beim Start

Um persistente Regeln beim Start zu laden:

```typescript
import { loadLanguageRulesFromSupabase } from "./loadLanguageRulesFromSupabase";

// Beim Start der Anwendung (z. B. in page.tsx oder einem API-Route)
await loadLanguageRulesFromSupabase();
```

## Integration in externe AI-Schicht

Wenn ein AI-Trigger mit `reason: "synonym_lookup"` gesetzt wird:

```typescript
// In der AI-Schicht (z. B. ElevenLabs-Handler)
if (result.aiTrigger?.reason === "synonym_lookup" && result.aiTrigger.unknownTerms?.length > 0) {
  const term = result.aiTrigger.unknownTerms[0];
  
  // AI fragen (z. B. OpenAI)
  const aiResponse = await askOpenAI(`Der User-Begriff ist: '${term}'. Beschreibe kurz, was das ist, gib typische Schlüsselwörter, und welche Produkt-Kategorien dazu passen. Antwort als JSON: { canonical: string, keywords: string[], categoryHints: string[] }`);
  
  // Regel registrieren
  await registerLanguageRuleFromAi(term, "de", aiResponse);
}
```

## Wichtige Hinweise

- **Keine Breaking Changes**: `runSellerBrain` bleibt synchron
- **Memory-First**: Regeln werden zuerst im Memory-Cache gesucht (schnell)
- **Supabase-Fallback**: Wenn Memory leer ist, wird Supabase abgefragt (async, extern)
- **AI nur einmal**: Pro Begriff+Locale wird AI nur einmal gefragt
- **Wax-Beispiel**: Nutzt weiterhin Produktbeschreibung, keine generische AI-Antwort

## Tests

Alle bestehenden Szenario-Tests (S1-S26) müssen weiterhin PASS sein.











