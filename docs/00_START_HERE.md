Projektbasis (aktuell ausgecheckt):
- Branch: docs/update-inventory-2025-12-20 (Docs-Update-Branch)
- Arbeitsbasis: feature/curated1000 (Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70)

Last-known-good:
- Tag/Referenz: stable/1000pass-20251218_010858 (laut Doku)

Schnellstart (lokal)
- pnpm install
- pnpm dev
- pnpm sellerbrain:scenarios   # immer ausführen; bei Fail: failing sections posten

Tests / CI (Doku)
- Core tests: 388 (historisch)
- EFRO scenario target: 1000 (Env: EFRO_SCENARIO_TARGET)

Deploy
- Hosting: Render
- Produkte/Shop-Data: Supabase

Arbeitsregel
- minimal-invasive Änderungen
- vor PR/Push immer sellerbrain-Szenarien ausführen
- Evidence-first: bei Bugs immer File+Zeilenbereich zeigen (rg-Ausgabe)




@'
# EFRO – START HERE (Stand: 2025-12-21)

## Ziel
EFRO ist ein Shopify-embedded Avatar-Seller (Chat + später Voice), der Produkte nach Intent/Budget/Kategorie empfiehlt.


## Produktquelle: warum manchmal nur 50 Produkte erscheinen
Wichtig: `debug-products` ist ein Debug/Fixture-Dataset (typisch ~50) und NICHT Supabase.

- Debug (≈50):
  /api/efro/debug-products?shop=local-dev
- Supabase raw (≈120: 100 good + 20 bad):
  /api/supabase-products?shop=local-dev
- EFRO produktiv/normalisiert (≈120):
  /api/efro/products?shop=local-dev

Truth-Run für Szenario-Tests:
EFRO_DEBUG_PRODUCTS_URL muss auf /api/efro/products zeigen (nicht debug-products).

## Aktueller Stand (JETZT)
✅ Render Build ist grün.  
✅ Endpoints auf Render liefern Daten:
- `/api/health` -> ok:true
- `/api/efro/products?shop=avatarsalespro-dev.myshopify.com` -> success:true, source: products_demo
- `/api/supabase-products?shop=avatarsalespro-dev.myshopify.com` -> success:true, count: 49
- `/api/shopify-products?shop=avatarsalespro-dev.myshopify.com` -> source: shopify-admin

## Repo / Deploy
- Repo: studiovoicetools/efro
- Render deployt: main
- Lokal: C:\efro_fast\efro_work_fixed

## Lokaler Start (PowerShell)
1) `.env.local` setzen (siehe docs/ENVIRONMENT.md)
2) Start:
```powershell
cd C:\efro_fast\efro_work_fixed
pnpm i
pnpm dev
Smoke Tests:

powershell
Code kopieren
irm "http://127.0.0.1:3000/api/health"
irm "http://127.0.0.1:3000/api/efro/products?shop=avatarsalespro-dev.myshopify.com" | select success,source
irm "http://127.0.0.1:3000/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count
Render Smoke Tests
powershell
Code kopieren
$BASE="https://efro-prod.onrender.com"
irm "$BASE/api/health"
irm "$BASE/api/efro/products?shop=avatarsalespro-dev.myshopify.com" | select success,source
irm "$BASE/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count
irm "$BASE/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | select source
Baustellen (kurz)
P0:

Shopify Embed (Widget im Demo-Storefront)

Onboarding → Lipsync zuverlässig (Conversation-Flow angleichen)

Event Logs (Session/Intent/Reco/CTA/Error)

Details: docs/OPEN_TICKETS.md, docs/GO_LIVE_STATUS.md
'@ | Set-Content -Encoding UTF8 .\docs\00_START_HERE.md

perl
Code kopieren

---

## 2.3 `docs/RENDER_OPS.md` (Render-Betrieb nur mit Commands)

```powershell
cd C:\efro_fast\efro_work_fixed

@'
# RENDER OPS (Stand: 2025-12-21)

## Regel
Render deployt den konfigurierten Branch: **main**.

## Nach jedem Deploy: Smoke Tests
```powershell
$BASE="https://efro-prod.onrender.com"
irm "$BASE/api/health"
irm "$BASE/api/efro/products?shop=avatarsalespro-dev.myshopify.com" | select success,source
irm "$BASE/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count
irm "$BASE/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | select source
Wenn Build/Runtime wegen ENV crasht
Render ENV prüfen (muss gesetzt sein):

SUPABASE_URL

SUPABASE_SERVICE_KEY

NEXT_PUBLIC_SUPABASE_URL

Redeploy/Restart im Render UI

Lokal Production-Build nachstellen:

powershell
Code kopieren
cd C:\efro_fast\efro_work_fixed
pnpm -s guard:mojibake
pnpm lint
pnpm build
'@ | Set-Content -Encoding UTF8 .\docs\RENDER_OPS.md

yaml
Code kopieren

---

# 3) Docs committen + pushen (nur wenn du willst)

```powershell
cd C:\efro_fast\efro_work_fixed
git status
git add .\docs\ENVIRONMENT.md .\docs\00_START_HERE.md .\docs\RENDER_OPS.md
git commit -m "docs: clarify local env + render ops + current status (2025-12-21)"
git push origin main
