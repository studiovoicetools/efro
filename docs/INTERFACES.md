# EFRO – Interfaces (API Routes, Webhooks, Integrationen)

Last updated: 2025-12-20
Commit (working baseline): c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70
Branch (docs update): docs/update-inventory-2025-12-20
Maintainer: Derin

## Harte Regeln
- Keine Secrets: niemals .env Values, nur Env-Var NAMEN.
- Evidence-first: Method/Parameter werden aus Code abgeleitet, sonst TODO.
- Tenant/Shop Begriffe: siehe docs/GLOSSARY.md

## Tenant-Key Regel (P0)
- External (URL Query): canonical key ist `shop`.
- Internal (Code): canonical variable ist `shopDomain`.
- Legacy: `shopDomain` als Query-Key ist erlaubt, aber nur als Übergang (nicht weiter ausbauen).
- Jede neue Route MUSS `shop` akzeptieren und intern nach `shopDomain` mappen (siehe docs/GLOSSARY.md).

## API Routes (Inventur – Methods + Tenant-Key)
Quelle: src/app/api/**/route.ts + rg export async function GET/POST + searchParams.get(...)

| Route (URL) | Methods | Tenant-Key (evidence) | Contract (Input → Output) | Source file |
|---|---|---|---|---|
| /api/health | GET | – | TODO | src/app/api/health/route.ts |
| /api/get-realtime-token | GET | – | TODO | src/app/api/get-realtime-token/route.ts |
| /api/subscriptions | GET | – | TODO | src/app/api/subscriptions/route.ts |
| /api/verify | GET | shop (query) | TODO | src/app/api/verify/route.ts |
| /api/demo-products | GET | – | TODO | src/app/api/demo-products/route.ts |
| /api/supabase-products | GET | – | TODO | src/app/api/supabase-products/route.ts |
| /api/supabase/sync-schema | GET | secret (query) | TODO | src/app/api/supabase/sync-schema/route.ts |
| /api/shopify-products | GET | – | TODO | src/app/api/shopify-products/route.ts |
| /api/shopify/callback | GET | shop (query via url.searchParams) | TODO | src/app/api/shopify/callback/route.ts |
| /api/checkout/url | POST | – | TODO | src/app/api/checkout/url/route.ts |
| /api/cart/add | POST | – | TODO | src/app/api/cart/add/route.ts |
| /api/billing | POST | – | TODO | src/app/api/billing/route.ts |
| /api/landing-chat | POST | – | TODO | src/app/api/landing-chat/route.ts |
| /api/eleven-offer | POST | – | TODO | src/app/api/eleven-offer/route.ts |
| /api/convai/offer | POST | – | TODO | src/app/api/convai/offer/route.ts |
| /api/get-signed-url | POST | – | TODO | src/app/api/get-signed-url/route.ts |
| /api/get-signed-url-seller | POST | – | TODO | src/app/api/get-signed-url-seller/route.ts |
| /api/explain-product | POST | – | TODO | src/app/api/explain-product/route.ts |
| /api/sellerbrain-ai | POST | – | TODO | src/app/api/sellerbrain-ai/route.ts |
| /api/cross-sell | GET, POST | – | TODO | src/app/api/cross-sell/route.ts |
| /api/shopify-import | POST | – | TODO | src/app/api/shopify-import/route.ts |
| /api/shopify-webhook | POST | – | TODO | src/app/api/shopify-webhook/route.ts |
| /api/webhooks/app-uninstalled | POST | – | TODO | src/app/api/webhooks/app-uninstalled/route.ts |
| /api/webhooks/gdpr/customer-redact | POST | – | TODO | src/app/api/webhooks/gdpr/customer-redact/route.ts |
| /api/efro/shops | GET | – | TODO | src/app/api/efro/shops/route.ts |
| /api/efro/shop-meta | GET | shop (query) | TODO | src/app/api/efro/shop-meta/route.ts |
| /api/efro/shop-settings | GET, POST | shop (query) | TODO | src/app/api/efro/shop-settings/route.ts |
| /api/efro/products | GET | shop (query) | TODO | src/app/api/efro/products/route.ts |
| /api/efro/suggest | GET, POST | shop (query) | TODO | src/app/api/efro/suggest/route.ts |
| /api/efro/debug-shop-meta | GET | shop (query) | TODO | src/app/api/efro/debug-shop-meta/route.ts |
| /api/efro/debug-products | GET | shop (query via url.searchParams) | TODO | src/app/api/efro/debug-products/route.ts |
| /api/efro/events | GET | shopDomain (query) | TODO | src/app/api/efro/events/route.ts |
| /api/efro/log-event | POST | shopDomain? (body) | TODO | src/app/api/efro/log-event/route.ts |
| /api/efro/onboard-shop | POST | shopDomain (body) | TODO | src/app/api/efro/onboard-shop/route.ts |
| /api/efro/voice-preview | POST | – | TODO | src/app/api/efro/voice-preview/route.ts |
| /api/efro/ai-unknown-terms | POST | shopDomain? (body) | TODO | src/app/api/efro/ai-unknown-terms/route.ts |
| /api/efro/admin/update-plan | POST | shopDomain (body) | TODO | src/app/api/efro/admin/update-plan/route.ts |
| /api/efro/repository/shop | GET | shopDomain (query) | TODO | src/app/api/efro/repository/shop/route.ts |
| /api/efro/repository/products | POST | – | TODO | src/app/api/efro/repository/products/route.ts |
| /api/efro/repository/cache | GET, POST | shopId (query) | TODO | src/app/api/efro/repository/cache/route.ts |

## Webhooks (existieren – Verification/Signature folgt aus Code)
- /api/shopify-webhook (POST)
- /api/webhooks/app-uninstalled (POST)
- /api/webhooks/gdpr/customer-redact (POST)

## Nächster Schritt
Contracts (Body/Headers/Outputs) pro Route aus Code extrahieren:
- searchParams.get(...)
- await request.json()
- headers.get(...)








INCIDENT: Render Build Crash – Supabase ENV / Top-Level Client

Datum: 2025-12-20 → 2025-12-21

Symptom

Render Build:

„Collecting page data …“

Console: ❌ SUPABASE_URL oder SUPABASE_KEY nicht gesetzt!

Error: supabaseKey is required

Build failed: Failed to collect page data for /api/supabase/sync-schema

Parallel:

/api/supabase-products auf Render gab: {"error":"supabaseUrl is required."}

Ursache

A) Branch/Commit mismatch

Render deployte main (Commit 807bf10)

Fixes lagen in feature/curated1000

B) Build-Kontext führt Code aus

Supabase Client wurde zu früh erstellt (Module-Top-Level)

Wenn ENV im Build-Kontext fehlt/anders ist → Crash

C) NEXT_PUBLIC_SUPABASE_URL fehlte auf Render

route /api/supabase-products brauchte NEXT_PUBLIC_SUPABASE_URL

Fix

NEXT_PUBLIC_SUPABASE_URL auf Render gesetzt

API Routes build-safe gemacht:

createClient() nur im Handler

Wenn ENV fehlt: return 500 JSON statt throw

feature/curated1000 in main gemerged und main gepusht

Prevention / Regeln

Render-Branch klar festlegen (main) und Fixes immer nach main mergen.

Keine ENV-abhängigen Clients auf Module-Top-Level.

Render ENV immer inkl. NEXT_PUBLIC_SUPABASE_URL setzen, wenn Route es nutzt.
'@ | Set-Content -Encoding UTF8 .\docs\INCIDENT_RENDER_BUILD_SUPABASE_ENV_2025-12-20.md


---

# C) Prüfen, was geändert wurde

```powershell
git status
git diff --stat

D) Commit + Push (Docs)
git add .\docs
git commit -m "docs: update status + render incident + next steps (2025-12-21)"
git push origin main

E) Go-Live Checkliste (als Datei + als Befehle)
1) Datei erzeugen: docs/CHECKLIST_GO_LIVE_COMMANDS.md
@'
# GO-LIVE CHECKLIST (COMMANDS) – Stand: 2025-12-21

## 0) Basis: Repo / Branch / Clean
```powershell
cd C:\efro_fast\efro_work_fixed
git checkout main
git pull origin main
git status

1) Render Smoke Test (MUSS GRÜN)
$BASE="https://efro-prod.onrender.com"
irm "$BASE/api/health"
irm "$BASE/api/efro/products?shop=avatarsalespro-dev.myshopify.com" | select success,source
irm "$BASE/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count
irm "$BASE/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | select source,products


Expected:

/api/health -> ok:true

efro/products -> source: products_demo

supabase-products -> count: 49

shopify-products -> source: shopify-admin

2) Render ENV Pflichtfelder prüfen (manuell in Render UI)

SUPABASE_URL

SUPABASE_SERVICE_KEY

NEXT_PUBLIC_SUPABASE_URL

(optional) NEXT_PUBLIC_SUPABASE_ANON_KEY

3) Shopify Embed (P0 – Go-Live Blocker)

Ziel: EFRO Widget im Shopify Demo-Storefront sichtbar, unten rechts, ohne Überlappungen.
Nach Implementierung:

# Nach jedem Deploy:
irm "$BASE/api/health"

4) Onboarding + Lipsync (P0)

Ticket: Onboarding auf stabilen Conversation-Flow umstellen, damit Lipsync zuverlässig ist.
Nach Implementierung: Onboarding-Seite im Browser testen (Voice/Avatar/Chat).

5) Event Logs / Telemetrie (P0/P1)

Events: session_start, intent_detected, recommendation_served, cta_clicked, error.
Nach Implementierung: Logs prüfen (Server + Client).

6) Curated Suite erweitern (P1)
pnpm -s guard:mojibake
pnpm test
# wenn vorhanden:
pnpm sellerbrain:scenarios


'@ | Set-Content -Encoding UTF8 .\docs\CHECKLIST_GO_LIVE_COMMANDS.md


## 2) Commit + Push

```powershell
git add .\docs\CHECKLIST_GO_LIVE_COMMANDS.md
git commit -m "docs: add go-live checklist with commands"
git push origin main

F) Mini-Tooling Hinweis (damit du nie wieder “findstr” suchst)

In PowerShell statt findstr:

git log --oneline --all | Select-String -SimpleMatch "807bf10"



