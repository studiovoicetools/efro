# EFRO Go/No-Go Checklist (evidence-backed) — Stand 2025-12-28

Diese Datei ist eine **ausführbare** Checkliste: Jede Zeile ist ein Gate mit Proof-Command.
Regel: **Kein Monster-Command**. Immer in kurzen Chunks arbeiten.

## 0) Preconditions
- Branch/Commit dokumentieren:
  - `git rev-parse --abbrev-ref HEAD`
  - `git rev-parse HEAD`
  - `git log -1 --oneline`

- Node/PNPM:
  - `node -v`
  - `pnpm -v`

## 1) Hygiene Gates (müssen immer grün sein)
### 1.1 Mojibake/Encoding Guard
- Run:
  - `pnpm guard:mojibake`
- Erwartung:
  - Exit Code 0

### 1.2 Lint
- Run:
  - `pnpm lint`
- Erwartung:
  - Exit Code 0

### 1.3 Build (CI-nah)
- Run:
  - `pnpm build`
- Erwartung:
  - Exit Code 0

## 2) Logic Gates (SellerBrain)
Diese Gates basieren auf deinen realen Scripts aus `package.json`:

### 2.1 EFRO Testsuite (SellerBrain)
- Run:
  - `pnpm test:efro`
- Erwartung:
  - Exit Code 0

### 2.2 SellerBrain Budget Test
- Run:
  - `pnpm sellerbrain:test`
- Erwartung:
  - Exit Code 0

## 3) Scenario Gates (Core/Curated/Generated)
Wichtig: Es gibt zwei Runner:
- `pnpm sellerbrain:scenarios` → `scripts/test-sellerBrain-scenarios.ts`
- `pnpm sellerbrain:scenarios:curated` → `scripts/test-sellerBrain-scenarios-curated.ts`

### 3.1 Curated Gate (Core + Live)
- Run (bindend):
  - `EFRO_SCENARIO_TARGET=0 pnpm sellerbrain:scenarios:curated`
- Hinweis:
  - Der Curated-Runner **FAILt absichtlich**, wenn `EFRO_SCENARIO_TARGET > 0` gesetzt ist.
- Erwartung:
  - Exit Code 0
  - Kein “artificial fill” über target

### 3.2 Full/Expanded Scenarios Gate (Target optional)
- Run (ohne Expansion):
  - `EFRO_SCENARIO_TARGET=0 pnpm sellerbrain:scenarios`
- Optional (Expansion auf N – nur wenn bewusst gewünscht):
  - `EFRO_SCENARIO_TARGET=1000 pnpm sellerbrain:scenarios`
- Erwartung:
  - Exit Code 0
  - Report zeigt keine Fails

Proof-Commands (Code-Navigation):
- `rg -n "EFRO_SCENARIO_TARGET" scripts/test-sellerBrain-scenarios.ts`
- `rg -n "EFRO_SCENARIO_TARGET" scripts/test-sellerBrain-scenarios-curated.ts`

## 4) “Live-nah” Product Source Gates
Prinzip: EFRO darf nicht still zum **Mock-Profi** werden.

### 4.1 Dev-Server starten
- Run:
  - `pnpm dev`
- Erwartung:
  - Server läuft auf 127.0.0.1:3000

### 4.2 Products Source prüfen (Demo)
- Run:
  - `curl -sS "http://127.0.0.1:3000/api/efro/products?shop=demo&debug=1" | jq .source,.debug`
- Erwartung:
  - `.debug` ist vorhanden
  - `forceSource` ist aktuell Trace-only (siehe SSOT)

### 4.3 Products Source prüfen (REAL SHOP)
- Run:
  - `curl -sS "http://127.0.0.1:3000/api/efro/products?shop=<REAL_SHOP>&debug=1" | jq .source,.debug`
- Erwartung (Go-Live Gate):
  - `.source` ist **nicht dauerhaft** `mock`
  - `.debug` zeigt nachvollziehbar, warum welche Quelle gewählt wurde

Optional (nur Trace, kein Enforce):
- `curl -sS "http://127.0.0.1:3000/api/efro/products?shop=<REAL_SHOP>&debug=1&forceSource=repo" | jq .source,.debug`

## 5) Ausgabe speichern (Beweis)
Empfohlen: pro Run ein Logfile:
- `pnpm sellerbrain:scenarios 2>&1 | tee _out.txt`
- `_out.txt` ist bereits im .gitignore (niemals committen)

---

Wenn ein Gate rot ist:
- Erst SSOT/GO_NO_GO aktualisieren (was ist rot, warum, wie reproduzierbar)
- Dann minimaler Fix
- Dann Gate wiederholen
