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

---

# EFRO – START HERE (Stand: 2025-12-21)

## Ziel
EFRO ist ein Shopify-embedded Avatar-Seller (Chat + später Voice), der Produkte nach Intent/Budget/Kategorie empfiehlt.

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

---

Weitere Details:
- docs/OPEN_TICKETS.md
- docs/GO_LIVE_STATUS.md
- docs/ENVIRONMENT.md
- docs/RENDER_OPS.md

