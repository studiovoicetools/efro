# EFRO Control Center (SSOT)

Stand: 2026-01-04  
Regel: **Ist-Stand wird durch `docs/SSOT_EVIDENCE.md` belegt** (generiert via `./scripts/ssot-scan.sh`).  
Wenn etwas nicht belegt ist: **FEHLT IM SSOT**.

---

## 0) Nicht verhandelbar
- Workflow: **Befehl → Ausgabe → nächster Befehl**
- Keine verdeckten Refactors
- Vor riskanten Änderungen: Backup/Checkpoint
- Nur live-relevante Fixes + Go-Live Gates
- Jede Änderung endet mit **Proof-Ausgabe** (ExitCode/Log)

---

## 1) Aktueller Git-Stand (Evidence)
- Branch: `chore/docs-reset-20260104`
- Letzter Commit (Docs-Reset): `706ddb7` (docs: remove legacy docs (reset))

---

## 2) Runtime Entry-Points (Top-Level)
> Detail-Landkarte wird aus Evidence abgeleitet (Routes/ENV/rg-Hints).

### 2.1 Frontend
- `src/app/avatar-seller/page.tsx` — EFRO Sales Widget / Chat UI

### 2.2 Backend (API)
- Kern: `src/app/api/efro/suggest/route.ts`

### 2.3 Brain / Sales Logic
- Brain-Orchestrierung: `src/lib/sales/brain/*` (siehe Evidence `BRAIN_HINTS`)

### 2.4 Data Layer
- Supabase Zugriff: `src/lib/*` (siehe Evidence `SUPABASE_HINTS`)
- Shopify/OAuth/Webhooks/Billing: `src/*` (siehe Evidence `SHOPIFY_HINTS`)

---

## 3) API Routes (Evidence-basiert)
Quelle: `docs/SSOT_EVIDENCE.md` → `API_ROUTES`

Aktuelle Routes (01/04):
- `src/app/api/eleven-offer/route.ts`
- `src/app/api/convai/offer/route.ts`
- `src/app/api/health/route.ts`
- `src/app/api/verify/route.ts`
- `src/app/api/get-signed-url-seller/route.ts`
- `src/app/api/demo-products/route.ts`
- `src/app/api/supabase-products/route.ts`
- `src/app/api/cross-sell/route.ts`
- `src/app/api/sellerbrain-ai/route.ts`
- `src/app/api/shopify-import/route.ts`
- `src/app/api/landing-chat/route.ts`
- `src/app/api/shopify-webhook/route.ts`
- `src/app/api/get-signed-url/route.ts`
- `src/app/api/webhooks/app-uninstalled/route.ts`
- `src/app/api/webhooks/gdpr/customer-redact/route.ts`
- `src/app/api/shopify/callback/route.ts`
- `src/app/api/efro/repository/cache/route.ts`
- `src/app/api/efro/repository/products/route.ts`
- `src/app/api/efro/repository/shop/route.ts`
- `src/app/api/efro/shops/route.ts`
- `src/app/api/efro/products/route.ts`
- `src/app/api/efro/log-event/route.ts`
- `src/app/api/efro/voice-preview/route.ts`
- `src/app/api/efro/ai-unknown-terms/route.ts`
- `src/app/api/efro/debug-shop-meta/route.ts`
- `src/app/api/efro/events/route.ts`
- `src/app/api/efro/onboard-shop/route.ts`
- `src/app/api/efro/shop-meta/route.ts`
- `src/app/api/efro/suggest/route.ts`
- `src/app/api/efro/admin/update-plan/route.ts`
- `src/app/api/efro/debug-products/route.ts`
- `src/app/api/efro/shop-settings/route.ts`
- `src/app/api/checkout/url/route.ts`
- `src/app/api/supabase/sync-schema/route.ts`
- `src/app/api/billing/route.ts`
- `src/app/api/get-realtime-token/route.ts`
- `src/app/api/explain-product/route.ts`
- `src/app/api/subscriptions/route.ts`
- `src/app/api/cart/add/route.ts`
- `src/app/api/shopify-products/route.ts`

Regel: Bei Änderungen `./scripts/ssot-scan.sh` laufen lassen und diese Liste nur über Evidence aktualisieren.

---

## 4) Suggest Contract (live-relevant)
### 4.1 `/api/efro/suggest`
Input (minimal):
- `query: string`
- `shop: string`
- optional: `context`
- optional: `previousRecommended`

Output (minimal):
- `reply: string`
- `recommended: array`
- optional: `debug`

Invarianten:
- `reply` darf keine Artefakte/forbidden chars enthalten.
- `recommended` muss zu Intent/Kategorie/Budget passen.
- Null-Katalog ⇒ definiertes Fallback statt Crash/500.

---

## 5) ENV Register (Evidence-basiert)
Quelle: `docs/SSOT_EVIDENCE.md` → `ENV_READS`

### 5.1 Supabase (Evidence)
- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

### 5.2 EFRO / Tests (Evidence)
- `EFRO_BASE_URL`
- `EFRO_SHOP`
- `EFRO_TARGET_TURNS`
- `EFRO_SEED`
- `EFRO_CONV_MIN_TURNS`
- `EFRO_CONV_MAX_TURNS`
- `EFRO_EXPECT_RAW_COUNT`
- `EFRO_FAIL_FAST`
- `EFRO_QUIET`
- `EFRO_PRODUCTS_FIXTURE`
- `EFRO_EXPECT_BAD_MAX`
- `EFRO_PRODUCTS_TAKE`
- `EFRO_PRODUCTS_LIMIT`
- `EFRO_PRODUCTS_TIMEOUT_MS`
- `EFRO_SHOP_UUID`
- `EFRO_DEBUG_PRODUCTS_URL`
- `EFRO_ALLOW_FIXTURE_FALLBACK`
- `EFRO_CONVGEN_FIXTURE_PATH`
- `EFRO_CONVGEN_ALLOW_FIXTURE_FALLBACK`
- `EFRO_CONVGEN_SOURCE`
- `EFRO_CONVGEN_MULTITURN_RATIO`
- `EFRO_CONVGEN_NOISE_RATIO`
- `EFRO_CONVGEN_STRICT_ENCODING`
- `CONV_GEN_TARGET`
- `CONV_SEED`

### 5.3 OpenAI (Evidence)
- `OPENAI_API_KEY`

Regel: Zweck + Fundstelle („wo gelesen“) ergänzen wir nur bei Bedarf, dann mit `rg -n <VAR>`.

---

## 6) Go-Live Gates (3/3)
Gate 1: Katalog/ShopScan
- Katalogquelle klar + deterministisch pro Shop
- keine RLS-Leaks / Security korrekt

Gate 2: Commerce
- Cart/Add/Checkout robust, keine 500er

Gate 3: Installation & Betrieb
- OAuth Callback funktioniert
- Webhooks laufen
- Billing/Subscriptions sauber
- Monitoring/Alerts aktiv

---

## 7) Monitoring / Events (Minimal-Standard)
Pflichtfelder:
- `ts` ISO, `env`, `shop`, `component`, `event`, `traceId`, `ok`, `ms`, `meta`

Empfohlene Events:
- `suggest_start`, `suggest_done`
- `catalog_load`, `catalog_empty`
- `policy_block`
- `error`


---

## 8) Git Push Auth (Wichtig)
Problem:
- `git push` über HTTPS fragt nach Username/Password und scheitert mit:
  "Password authentication is not supported for Git operations."
Lösung (Standard):
- SSH Remote verwenden: `git@github.com:studiovoicetools/efro.git`
- Push läuft dann ohne Passwortprompt.

Hinweis:
- Google/Web-Login ist nicht gleich Git-Auth.
- Für HTTPS wäre ein Personal Access Token nötig, empfohlen ist aber SSH.

---

## 9) Go/No-Go Status (Stand jetzt, 2026-01-04)

Gate 3 OAuth Minimum E2E: NEIN
- Diagnose + Redirect/client_id + Distribution-Blocker erkannt, aber Install→Callback→Token-Save→Shop-Record nicht sauber E2E bewiesen.

Gate 2 Commerce Actions: NEIN
- Cart/Checkout/Add-to-cart Contract + Executor + Tests nicht umgesetzt / nicht bewiesen.

Gate 1 ShopScan/Shop-Truth: TEILWEISE
- Katalog/Fixtures + debug-products + Hardcore-Tests vorhanden,
  aber echter Shop-Scan im installierten Shop nicht E2E bewiesen.

E2E Track dev+prod Shop Go/No-Go: NEIN
- echter Install→Scan→Widget→Cart→Checkout→Billing End-to-End nicht durchgetestet.


## 10) Definition: "E2E bewiesen" (Proof Chain)

Ein Gate gilt erst als GRÜN, wenn mindestens ein kompletter Proof-Run dokumentiert ist:
- Command(s) + Output (HTTP Status/JSON) + persistierter Zustand (DB/Logs)

### Gate 3 OAuth Minimum – Proof Chain (Minimal)
Ziel: Install → Callback → Token gespeichert → Shop-Record vorhanden (DB) → Shop-Meta abrufbar

Proof-Run (minimal, belegt durch Outputs):
1) Callback erreichbar und liefert Redirect/OK:
   - Route: /api/shopify/callback
2) Shop wird onboarded / Record wird erstellt:
   - Route: /api/efro/onboard-shop
3) Shop-Meta ist abrufbar:
   - Route: /api/efro/shop-meta oder /api/efro/debug-shop-meta
4) Persistenz belegt (Supabase): Shops-Tabelle hat Row für Shop/UUID

### Gate 2 Commerce – Proof Chain (Minimal)
Ziel: Add-to-cart → Checkout URL → Order/Redirect (mindestens URL)

1) /api/cart/add (200)
2) /api/checkout/url (200 + url)
3) optional: billing/subscriptions nicht 500

### Gate 1 ShopScan – Proof Chain (Minimal)
Ziel: echter Shop-Scan importiert Produkte → /api/efro/repository/products liefert >0

1) /api/shopify-import (200, count > 0) oder Scan-Flow equivalent
2) /api/efro/repository/products (200, count > 0)
3) /api/efro/suggest nutzt echten Katalog (nicht Fixture)


---

## 11) Profi-Analyse (Statusreport)
Siehe: docs/PROFI_ANALYSE_2026-01-04.md

---

## 12) Gate 3: Finaler Go/No-Go Status

**Gate 3 OAuth Minimum E2E**: GRÜN  
- **Erfolgreicher Token-Austausch** nach OAuth Callback
- **Shop-Record gespeichert** (DB/API Proof)
- **Onboarding Flow** erfolgreich durchgeführt
- **Smoke-Test** mit folgenden Routen:  
  - `/api/efro/shop-settings`
  - `/api/efro/shop-meta`
  - `/api/efro/products` (aber `source=products_demo` → Fix notwendig)
  - `/api/efro/suggest` (Route erwartet zusätzliche Parameter)

**Fehlerbehebung**:
- 400 bei `/api/efro/suggest`: Die Route benötigt andere Parameter, was die **finale E2E Proof Chain** nicht blockiert.

**Zusammenfassung**:  
Gate 3 ist erfolgreich abgeschlossen. EFRO ist bereit für den **Go-Live**.


---

## 13) Go-Live Dokument (SSOT, 2026-01-06)
Siehe: docs/GO_LIVE_SSOT_2026-01-06.md

---

## 13) Gate-2 Commerce (SSOT Proof)

SSOT: `docs/GATE2_COMMERCE_SSOT_2026-01-06.md`

Status:
- Gate-2 Commerce Actions: **GRÜN** (Prod Proof: Create DraftOrder + Update Qty)
- Hinweis: Root-Query `draftOrder(id)` kann ohne `read_draft_orders` scheitern → **Gate-2+ optional**, kein Blocker.

---

## Gate-2 FINAL SSOT (2026-01-07)
Siehe: docs/GATE2_FINAL_SSOT_2026-01-07.md

---

## Post-RLS Proof (2026-01-09)
SSOT: `docs/POST_RLS_PROOF_SSOT_2026-01-09.md`
Enthält: Service-Role Log-Proof, Column-Reality (shop != shop_domain), Claim-Reality (shop_domain fallback shop), No-Leak Proof.

---

## FINAL Gate-1/2/3 Doku Pack (2026-01-09)
Siehe: docs/FINAL_GATE123_PACK_2026-01-09.md
