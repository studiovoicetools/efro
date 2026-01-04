# Profi-Analyse: Was wurde gemacht, was ist noch offen (Stand: 2026-01-04)

## 1) Was wirklich gemacht wurde (belegt durch Outputs / Zusammenfassung)

### A) Fokuswechsel: UI → Hardcore-Go-Live-Test
Ursprüngliches Ziel (Avatar-Seller UI-Smoke + Commit/Push auf refactor/sellerbrain-modules) wurde nicht abgeschlossen.
Stattdessen wurde auf einen Hardcore-HTTP-Konversationstest (conv10000) umgeschwenkt, der gegen einen laufenden Next-Server testet.

### B) Typecheck stabilisiert (Windows-Kopie)
Legacy/dev-pages TS-Breaker entschärft durch separates Typecheck-Setup:
- tsconfig.typecheck.json neu
- tsconfig.json angepasst (UTF-8 + Excludes für legacy/tests)
Ergebnis: pnpm -s tsc -p tsconfig.typecheck.json --noEmit war grün.

Commit + Push erfolgte auf Branch:
- Branch: wip/hardcore-test
- Commit: 50224f4 (chore(typecheck): …)

### C) Branch/Sync in WSL (Linux-Kopie)
Lokale Änderungen auf refactor/sellerbrain-modules wurden geparkt:
- git stash push -u -m "wsl-park before switching to wip/hardcore-test"

Danach Sync/Reset auf Remote:
- git fetch --all --prune
- git switch -C wip/hardcore-test origin/wip/hardcore-test

### D) Hardcore-Test conv10000 aufgebaut und Counts-Truth sauber getrennt
Test-Routen (lokal):
- GET http://127.0.0.1:3000/api/efro/products?shop=<SHOP>&debug=1
- POST http://127.0.0.1:3000/api/efro/suggest?shop=<SHOP>&text=<TEXT>

Truth-Setup:
- RAW/FIXTURE soll 120 Produkte enthalten (Anspruch: 100 clean + 20 bad).
- API liefert sichtbar ~100 (weil „bad“ gefiltert werden dürfen).

scripts/test-hardcore-conv10000.ts wurde so gepatcht, dass:
- EFRO_EXPECT_RAW_COUNT=120 hart gilt
- API-Mindestcount = rawCount - EFRO_EXPECT_BAD_MAX (z. B. 120-20=100)

### E) Reply-Fix: Mojibake + Operator-Hints raus aus Customer-Replies
Datei: src/lib/sales/brain/steps/08_reply.ts

Änderung:
- Default replyMode von operator auf customer (damit keine internen Betreiber-Hinweise im Kunden-Reply landen)
- Mojibake/kaputte Zeichen im Reply-Text wurden repariert/entfernt

Smoke-Ergebnis danach:
- Owner-Hint/Operator-Spuren nicht mehr im Kundenreply
- Mojibake-Check im aktuellen Output: NO
  (Wichtig: alte Logzeilen können noch „Hinweis f�r…“ zeigen)

---

## 2) Was noch offen ist (Blocker vs. „wichtig, aber später“)

### A) Blocker 1: Next/Build-Sauberkeit (Scripts als globale Dateien)
Problem: scripts/test-hardcore-conv10000.ts (und ggf. weitere scripts/test-hardcore-conv*.ts) erzeugen „Definitions conflict“,
weil TS sie als globale Script-Files behandelt, wenn kein Import/Export existiert.

Konsequenz: Production-Path (pnpm build && pnpm start) ist riskant/instabil, obwohl du ihn für Speed brauchst.

Fix: export {}; ganz oben in jede betroffene Script-Datei (mindestens alle scripts/test-hardcore-conv*.ts).

### B) Blocker 2: Fail-Cluster im conv10000 (anchor-keyword + refine)
Dominante Fail-Typen:
- anchor-keyword (Keywords wie „snowboard“ sehr häufig)
- refine (Constraint-Kombis führen zu Reco=0 oder Reply-Check-Fail)

Das ist aktuell der inhaltliche Grund, warum der Test noch nicht „Go-Live-tauglich“ ist.

### C) Blocker 3: Performance
Ziel: 1000 Turns in 1–3 Minuten (realistisch nur mit Production-Server + wenig Logging).
Ist noch offen, weil aktuell teils über pnpm dev und viel Output gelaufen wird.
Ohne Build-Sauberkeit (Blocker 1) kann der Speed-Pfad nicht sauber genutzt werden.

### D) UI-Track (Avatar-Seller) ist noch offen
/avatar-seller Runtime-Smoke + Commit/Push auf refactor/sellerbrain-modules wurde nicht abgeschlossen.
Aktuell ist die führende Arbeit auf wip/hardcore-test passiert (Single Source of Truth muss geklärt bleiben).

---

## 3) Schnittstellen / Variablen / Domains (damit niemand suchen muss)

### 3.1 Relevante Dateien

Hardcore / Tests:
- scripts/test-hardcore-conv600.ts (bestehender Runner)
- scripts/test-hardcore-conv10000.ts (neu/aktuell relevant)
- (Fix für Build): alle scripts/test-hardcore-conv*.ts → export {}; (Module-Mode)

Reply:
- src/lib/sales/brain/steps/08_reply.ts
- Parameter/Schalter: replyMode?: "customer" | "operator"
- Default wurde auf "customer" gedreht (damit Customer-Replies clean bleiben)

Typecheck:
- tsconfig.typecheck.json (neu)
- tsconfig.json (UTF-8 + excludes)

### 3.2 API-Routen (lokal)
Products:
- GET /api/efro/products?shop=<SHOP>&debug=1

Suggest:
- POST /api/efro/suggest?shop=<SHOP>&text=<TEXT>

### 3.3 Test-ENV (conv10000)
Server/Shop:
- EFRO_BASE_URL (Default: http://127.0.0.1:3000)
- EFRO_SHOP (z. B. test-shop.myshopify.com)

Turns/Seed/Conversation:
- EFRO_TARGET_TURNS (z. B. 10000)
- EFRO_SEED (z. B. 1)
- EFRO_CONV_MIN_TURNS, EFRO_CONV_MAX_TURNS (z. B. 2–5)

Laufverhalten:
- EFRO_QUIET=1 (nur FAIL + DONE)
- EFRO_FAIL_FAST=1 (stop beim ersten Fail)

Count-Guards:
- EFRO_EXPECT_RAW_COUNT=120
- EFRO_EXPECT_BAD_MAX=20

Logging:
- Logfile: /tmp/conv10000.log (per Redirect/Pipe)

### 3.4 Shopify-Domains (aus dem anderen Go-Live-Track, weiterhin relevant)
App-Host:
- https://app.avatarsalespro.com

Shops:
- avatarsalespro.myshopify.com
- avatarsalespro-dev.myshopify.com
