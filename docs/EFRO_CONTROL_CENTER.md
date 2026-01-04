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

