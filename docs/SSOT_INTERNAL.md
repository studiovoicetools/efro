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


---

## 9) Chat-Addendum — Stand 2025-12-28

Ziel dieses Chats:
- Eine **einzige**, robuste interne Wahrheit (SSOT), damit ein Nachfolger **nicht wieder bei 0** anfängt.
- Nebenbei: Git/Repo so härten, dass **keine lokalen Backups/Artefakte** jemals im Index landen.

Was in diesem Chat **tatsächlich umgesetzt** wurde (evidence-backed):

### 9.1 Branch-Strategie (main nicht anfassen)
- Es wurde bewusst ein separater Branch erstellt und genutzt:
  - Branch: `docs/ssot-20251228`
- SSOT liegt hier:
  - Datei: `docs/SSOT_INTERNAL.md`
- Grund: `main` bleibt clean / unangetastet, SSOT kann als PR später selektiv gemerged werden.

Proof-Commands:
- `git status -sb`
- `git log --oneline -n 10`
- `git branch -vv | sed -n '1,120p'`

### 9.2 SSOT Commit + Push (Beweis)
- Commit: `09bbc7c` — `docs(ssot): add internal single source of truth + products route forceSource trace`
- Danach: Branch wurde gepusht und tracked origin.

Proof-Commands:
- `git log --oneline -n 3`
- `git show --name-only --stat 09bbc7c`

### 9.3 Git-Index Bereinigung: getrackte Backups entfernt (wichtig!)
Problem:
- Es waren lokale Backup-Artefakte im Git-Index (u.a. `.bak`, `.BROKEN.bak`, `.backup/`, `_backup/`).

Fix in zwei Schritten (mit Safety Copies nach /tmp):
- Commit: `6feb12c` — stop tracking lokale Backup-Files + `.gitignore` gehärtet
- Commit: `9a8c5e6` — stop tracking `_backup` artifacts (u.a. eine große patch-Datei)

Proof-Commands:
- `git log --oneline -n 5`
- `git show --name-only --stat 6feb12c`
- `git show --name-only --stat 9a8c5e6`

### 9.4 Endzustand (muss so bleiben)
- Working tree clean:
  - `git status --porcelain` ist leer
- Keine getrackten Backups/Quarantäne:
  - `git ls-files | rg -n '(^|/)(\.backup/|_backup/|docs/_quarantine_)|(\.bak$|\.BROKEN\.bak$|\.bak2-)'`
- `.gitignore` enthält harte Regeln:
  - `docs/_quarantine_*/`
  - `*.bak`
  - `*.bak2-*`
  - `.backup/`
  - `_backup/`
  - `*.BROKEN.bak`


### 9.5 Products/forceSource — Trace-only (aktueller Stand)

Kontext:
- In diesem Chat wurde `forceSource` in `src/app/api/efro/products/route.ts` als **Debug/Trace** ergänzt.
- Wichtig: Stand jetzt **erzwingt** `forceSource` die Quelle **nicht** (Repo gewinnt weiterhin, solange vorhanden).

Beobachtetes Verhalten (Smoke):
- Request: `.../api/efro/products?debug=1&forceSource=repo`
  - `.debug.forcedSource` spiegelt `"repo"`
  - tatsächliche `.source` kann trotzdem repo/`"products"` bleiben (je nach repoResult.source)
- Request: `...&forceSource=supabase`
  - wird normalisiert auf `"supabase-fallback"` (Debug)
  - `.source` bleibt trotzdem Repo-basiert, wenn Repo Produkte liefert
- Request: `...&forceSource=loader`
  - Debug zeigt `"loader"`, aber `.source` bleibt Repo-basiert
- Konsequenz:
  - `forceSource` ist derzeit **nur Trace**, kein Enforcer.

Empfehlung für Nachfolger:
- Debug klar trennen in:
  - `requestedSource` (gewünscht)
  - `actualSource` (tatsächlich)
  - optional `fallbackReason`
- Erst danach entscheiden:
  - Hard-Enforce vs. Soft-Enforce (siehe SSOT Abschnitt 7)

### 9.6 Terminal-Regel: Keine Monster-Commands
Problem:
- Sehr lange Commands/Here-Docs können beim Copy/Paste “verrutschen” (Artefakte im Terminal-Input).

Regel (bindend):
- Alle Schritte in **Chunks** (3A, 3B, 3C …).
- Jede Änderung:
  - Precheck → Backup → Änderung → Verify → Commit → Push
- Bei Python safe-edits:
  - Marker/Anchor muss existieren, sonst **hart abbrechen**.
