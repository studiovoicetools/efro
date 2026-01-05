# EFRO Go-Live Dokument – Stand & Gates (Single Source of Truth)

Datum/Stand: 2026-01-06 (Europe/Istanbul)
Repo: ~/work/efro_work_fixed
Branch: wip/gate3-oauth-min-e2e
Prod Base URL: https://app.avatarsalespro.com
Test-Shop (DEV): avatarsalespro-dev.myshopify.com

## 0) Go-Live Definition (was bedeutet “live”?)

EFRO gilt als “Go-Live-ready”, wenn alle drei Gates grün sind:

Gate 1 – ShopTruth / Scan / Datenqualität: Shopdaten + Produkte sind zuverlässig verfügbar (Sync, Webhooks, Supabase Truth).

Gate 2 – Commerce Actions: EFRO kann echte Aktionen ausführen (Add-to-Cart, Varianten, Quantities, Checkout-Flows, ggf. Discounts).

Gate 3 – Installation/Betrieb: OAuth-Install/Callback, Webhooks, Monitoring-Basis, Uninstall-Hygiene, Deploy-Stabilität.

Aktueller Fokus/Status: Gate-3 ist jetzt grün (Minimum Betrieb). Gate-1/2 sind für “Profi-Seller” noch offen.

## 1) Gate-3 – Installation/Betrieb ✅ (GRÜN – Minimum Betrieb)

### 1.1 Release/Build Proof (Prod läuft exakt auf dem erwarteten Commit)

Command:
curl -s https://app.avatarsalespro.com/api/build; echo

Pass Criteria:
- HTTP 200
- JSON enthält NODE_ENV=production
- RENDER_GIT_COMMIT ist gesetzt und entspricht dem zuletzt ausgerollten Commit

Observed (Beispiel):
- RENDER_GIT_COMMIT=61af59c997a9d54c670e06a880788606ffb46333

### 1.2 OAuth Callback Proof (Install → Callback → Token persistiert) ✅

Ziel: Nachweis, dass der Shop-Token durch echten OAuth-Flow gespeichert wird.

A) Callback HTTP Proof
Endpoint (Beispiel):
GET /api/shopify/callback?code=***&hmac=***&host=***&shop=avatarsalespro-dev.myshopify.com&state=***&timestamp=***

Pass Criteria:
- HTTP 200 OK (oder klarer Redirect auf Success-Page)
- Danach Token/Shop-Record persistiert (siehe B)

B) Token Persistenz Proof
Command:
curl -s "https://app.avatarsalespro.com/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | head -c 800; echo

Pass Criteria:
- tokenSource: "shops"
- source: "shopify-admin"
- products.length > 0

Observed:
- source: "shopify-admin"
- tokenSource: "shops"
- tokenUpdatedAt gesetzt
- products: [...]

### 1.3 Webhook Ingestion → Supabase Proof ✅

Topic: products/update ✅

Command:
set -a; source .env.local; set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-webhook.ts \
  --base=https://app.avatarsalespro.com \
  --shop=avatarsalespro-dev.myshopify.com \
  --topic=products/update

Pass Criteria:
- HTTP 200
- Response enthält { ok:true, topic:"products/update" }
- Supabase Verify: found: 1 mit SKU

Observed:
- SMOKE-OK ✅ webhook -> Supabase products row exists

### 1.4 Uninstall Hygiene ✅ (Token invalidieren)

Command:
set -a; source .env.local; set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-uninstall.ts \
  --base=https://app.avatarsalespro.com

Pass Criteria:
- Fake shop row wird erzeugt
- Webhook app/uninstalled → HTTP 200
- Verify: access_token: null, onboarding_status: "uninstalled"

Observed:
- SMOKE-OK ✅ uninstall invalidated efro_shops row (fake shop)

### 1.5 Real Shopify Delivery Proof ⏳ (Optional, aber sehr wertvoll)

Pass Criteria:
Shopify Admin → Webhooks → Delivery Log:
- mindestens 1 Delivery zeigt 200 OK
- topic passend (products/update oder app/uninstalled)

### 1.6 Gate-3 Artefakte / Files (Source of Truth)

- src/app/api/build/route.ts
- src/app/api/shopify-webhook/route.ts
- scripts/smoke-shopify-webhook.ts
- scripts/smoke-shopify-uninstall.ts

## 2) Gate-1 – ShopTruth / Scan / Datenqualität ⏳ (TEILWEISE)

Minimum (für erste Customer-Demos):
- Produkte sind vorhanden (Webhook + Shopify Read OK)
- Shop-Record in efro_shops korrekt (domain/uuid/token/scopes/status)
- Sync-Strategie definiert (Webhook + Cron)

Noch offen:
- Cron Sync robust (Retry/Backoff, Delta-Sync)
- Policies/Shipping/Returns in ShopTruth
- Datenqualität: Kategorien/Tags/Varianten konsistent
- Monitoring/Logs für Sync-Fehler

## 3) Gate-2 – Commerce Actions ⛔ (OFFEN)

Minimum Actions:
- Add-to-cart (Variante/Quantity korrekt)
- Cart state lesen/ändern
- Checkout Link / Redirect Flow
- (Optional) Discounts / Bundles / Upsells

Status:
- Action-Contract + Executor + Tests: offen
- Hardcore v2 Action-Cases: offen

## 4) Security / Compliance (Go-Live Blocker) ⛔

Supabase: “RLS Disabled in Public” ist security-kritisch.

Minimum Ziel:
- RLS aktiv mind. auf: efro_shops, products, efro_shop_settings
- Policies: Service Role darf schreiben (Server)
- Reads/Writes sauber begrenzt (JWT claim / shop_uuid)

Status: offen

## 5) Monitoring / Betrieb (Minimum, Go-Live relevant)

Minimum:
- /api/build als Health-Proof ✅
- Log-Event Seite vorhanden, aber optimierbar ⏳
- Error Tracking (mind. console + structured logs) ⏳

## 6) One-Command Gate-3 Regression Check (immer vor Deploy)

set -a; source .env.local; set +a

echo "=== BUILD ==="
curl -s https://app.avatarsalespro.com/api/build; echo

echo
echo "=== SHOPIFY READ (tokenSource=shops, source=shopify-admin) ==="
curl -s "https://app.avatarsalespro.com/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | head -c 800; echo

echo
echo "=== WEBHOOK SMOKE products/update ==="
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-webhook.ts \
  --base=https://app.avatarsalespro.com \
  --shop=avatarsalespro-dev.myshopify.com \
  --topic=products/update

echo
echo "=== UNINSTALL SMOKE (fake shop) ==="
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-uninstall.ts \
  --base=https://app.avatarsalespro.com

echo "GATE3-REGRESSION-OK ✅"

## 7) Finaler Go-Live Status (kurz)

- Gate-3 ✅ GRÜN (Minimum Betrieb)
- Gate-1 ⏳ TEILWEISE
- Gate-2 ⛔ OFFEN
- Security/RLS ⛔ OFFEN (Go-Live Blocker für echte Kunden)
