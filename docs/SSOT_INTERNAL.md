# EFRO — SSOT (Internal) — Stand 2025-12-28

> Ziel: Eine einzige Wahrheit (Single Source of Truth) für interne Entwicklung.
> Audience: Der nächste ChatGPT-/Codex-„Nachfolger“ und Derin (Owner).
> Keine externen Entwickler, keine Nutzer-Doku. Nur intern, technisch tief.

---

## 0) Arbeitsmodus (bindend)

**Befehl → Ausgabe → nächster Befehl.**  
Keine „manuellen“ Edits. Keine IDE-/Editor-Anweisungen. Alles muss im Terminal reproduzierbar sein.

**Backup vor jeder Änderung:**
- Beispiel:
  - `cp <file> /tmp/<file>.bak.$(date +%Y%m%d_%H%M%S)`

**Patch-Standard (robust, bevorzugt):**
- Keine `git apply`-Diffs, weil zu fragil bei Drift/Whitespace.
- Stattdessen Python-„safe edits“:
  - Datei lesen
  - Anchor/Pattern muss existieren, sonst **hart abbrechen**
  - gezielt ersetzen/einfügen
  - schreiben
  - `rg`/`nl -ba` Verifikation
- Danach erst: `pnpm dev` / `curl` / Tests
- Danach erst: Commit

---

## 1) Repo / Branch / Lokaler Pfad

Repo (lokal):  
- `~/work/efro_work_fixed`

Ausgangslage am 2025-12-28:
- Arbeits-Branch für diese Doku + products-route Fixes:
  - `docs/ssot-20251228`
- Ursprungs-Branch (vor Branch-Switch):
  - `refactor/sellerbrain-modules`

Git-Status beim Start dieser Doku (relevant):
- Modifiziert:
  - `.gitignore`
  - `pnpm-workspace.yaml`
  - `src/app/api/efro/products/route.ts`
- Untracked (lokal erzeugt, soll NICHT committed werden):
  - `docs/_quarantine_20251227_235516/`
  - `src/app/api/efro/products/route.ts.bak2-2025-12-28-014546`

---

## 2) Tooling / System Utilities (WSL / Ubuntu noble)

Installiert/validiert:
- Python:
  - `python3` vorhanden
  - `python-is-python3` installiert → `python --version` => Python 3.12.3
- jq:
  - `jq --version` => jq-1.7

Hinweis aus apt:
- `libllvm19` wurde als „no longer required“ markiert (nur Info, kein Muss).

---

## 3) Git Hygiene: Quarantine + Backups nie committen

`.gitignore` wurde ergänzt um:
- `docs/_quarantine_*/`
- `*.bak`
- `*.bak2-*`

Verifikation lief erfolgreich via:
- `git check-ignore -v docs/_quarantine_20251227_235516/ ...`

---

## 4) EFRO Products API — aktuelle Wahrheit

### Datei
- `src/app/api/efro/products/route.ts`

### Kernlogik (Order of Operations)
Im aktuellen Stand der Route:

1) `shop=demo`:
   - versucht Shopify via `GET ${baseUrl}/api/shopify-products`
   - wenn ok → `source: "shopify"`
   - sonst fallback → `mockCatalog` (`source: "mock"`)

2) Nicht-demo:
   - bevorzugt „Repository“ (Supabase-Repo-Schicht):
     - `getEfroShopByDomain(shopDomain)` oder Fallback `getEfroDemoShop()`
     - `getProductsForShop(shop)`
   - wenn Produkte da → Response mit `source: repoResult.source ?? "repo"`

3) Fallback:
   - `tryFetchSupabaseProducts(baseUrl)` → `source: "supabase-fallback"`

4) Final fallback:
   - `loadProductsForShop(shopDomain || null)` → `source` aus Loader (typisch `shopify|mock|none`, danach `safeProducts`)

### forceSource / forcedSource / preferredSource (nur Debug aktuell)
Es wurde ein Parser ergänzt:

- Unterstützte Werte (normalisiert):
  - `repo`
  - `supabase` → mapped auf `supabase-fallback`
  - `supabase-fallback`
  - `loader`
  - `shopify`
  - `mock`

**Wichtig:**
- Der Parameter heißt in Requests typischerweise `forceSource=...`
- `forcedSource` wird aktuell **nur im debug payload** gespiegelt.
- Die Route **erzwingt** die Quelle derzeit **nicht** (kein Hard-Select).

### Beobachtetes Laufzeitverhalten (Smoke)
Per Curl/JQ wurde folgendes beobachtet:

- `curl .../api/efro/products?...&debug=1&forceSource=repo`
  - `.debug.forcedSource` zeigt `"repo"`
  - `.source` zeigte in der Praxis `"products"` (vermutlich `repoResult.source` aus der Repo-Schicht)

- `curl ...&forceSource=supabase`
  - `.debug.forcedSource` zeigt `"supabase-fallback"`
  - `.source` zeigte `"products"` (weil Repo weiterhin gewinnt, solange Repo Produkte liefert)

- `curl ...&forceSource=loader`
  - `.debug.forcedSource` zeigt `"loader"`
  - `.source` zeigte `"products"` (Repo gewinnt weiterhin)

- `curl -i ...&forceSource=shopify`
  - Response war `200` und enthielt Produkte + debug zeigte forcedSource `"shopify"`
  - aber `.source` blieb effektiv Repo-basiert (weil keine Erzwingung aktiv)

**Konsequenz:**
- `forceSource` ist aktuell ein Debug/Trace-Parameter, kein „Enforcer“.

---

## 5) Fehlgeschlagener Versuch: forceSource Enforcement via git apply

Es gab einen Versuch, einen Diff-Patch nach `/tmp/efro-forceSource-enforce.patch` zu schreiben und mit `git apply` anzuwenden.

Fehler:
- `error: patch with only garbage at line 4`

Ursache:
- Patch-Datei wurde durch Terminal-Output/Copy-Paste „verschmutzt“ (nicht reiner diff).

Entscheidung (bindend für Nachfolger):
- **Keine `git apply`-Patches** in diesem Projektzustand.
- Nur Python „safe edits“ (Anchor-basiert, idempotent, harte Checks).

---

## 6) Aktueller Produktstatus: Shopify vs Supabase

Hinweis aus Owner:
- Im Shopify-Store sind noch keine „aktuellen“ Produkte sichtbar,
  weil ein Supabase→Shopify Sync noch nicht durchgeführt wurde.

Damit gilt aktuell:
- Für echte Katalog-Truth ist Supabase/Repo-Schicht relevant.
- Shopify ist (noch) nicht die Truth-Source.

---

## 7) Nächste harte TODOs (für Nachfolger)

### A) forceSource wirklich erzwingen (wenn gewünscht)
Implementations-Entscheidung muss vorher klar sein:
- Option 1: Hard-Enforce (keine Fallbacks, wenn forcedSource gesetzt)
  - Wenn forcedSource=repo und repo leer → `success:false` + error
- Option 2: Soft-Enforce (bevorzugen, aber fallback erlaubt)
  - Dann muss Debug klar zeigen:
    - requested forcedSource
    - actualSource
    - reason for fallback

Aktuell ist es „Soft/Trace-only“ (nur Debug).

### B) Debug-Felder entkoppeln
Empfehlung:
- `requestedSource` (was der User wollte)
- `actualSource` (woher Produkte wirklich kamen)
- optional `fallbackReason`

### C) Tests/Smoke
Mindestens:
- curl-matrix über alle forcedSource Werte
- Erwartung: Wenn Enforce aktiv, muss `.source` dem requested Wert entsprechen oder `success:false`.

---

## 8) Diese Datei pflegen (SSOT-Regel)
Wenn Code geändert wird:
- zuerst SSOT updaten (Abschnitt + Datum)
- dann patch
- dann smoke
- dann commit

