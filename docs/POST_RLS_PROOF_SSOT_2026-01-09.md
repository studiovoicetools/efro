# EFRO – Post-RLS Proof + Claim-Reality + No-Leak (2026-01-09)

Stand: 2026-01-09 (Europe/Istanbul)  
Repo: ~/work/efro_work_fixed  
Branch: wip/gate3-oauth-min-e2e  
Prod: https://app.avatarsalespro.com  
Shop: avatarsalespro-dev.myshopify.com

## A) Gates bleiben grün (Server/Service-Role Flows)

### /api/build (Prod Proof)
ok:true, Node v20.19.5, Commit 9bda27331e78cb52b8d27060fd4990bc1d02bf7e

### Gate-3 Smoke (Webhook + Uninstall)
- products/update webhook → HTTP 200, action:"insert"
- Verify: products row existiert (shop_domain + shop_uuid gesetzt)
- app/uninstalled webhook → HTTP 200, efro_shops row invalidated (access_token:null, onboarding_status:"uninstalled")

### Gate-1 Suggest Proof
productsSource:"supabase_products", productCount:132, 2 Recommendations < 100€

### Gate-2 Commerce + Idempotency Proof
- CREATE_DRAFT_ORDER_CHECKOUT (Create) liefert draftOrderId + invoiceUrl
- Retry mit gleicher correlationId liefert denselben draftOrderId + invoiceUrl (idempotent)

## B) No-Leak Proof (anon/auth bekommt keine Secrets/Logs)

PostgREST mit ANON Key:
- GET /rest/v1/efro_shops?... → HTTP 401 + permission denied for table efro_shops
- GET /rest/v1/efro_action_log?... → HTTP 401 + permission denied for table efro_action_log
- GET /rest/v1/products?... → HTTP 401 + permission denied for table products

Ergebnis:
- anon/auth Clients können nicht an Tokens (efro_shops) oder Logs (efro_action_log).
- Zusätzlich sind products nicht öffentlich lesbar.

## C) Service-Role Proof (Server darf, Clients nicht)

PostgREST mit SERVICE KEY:
- GET /rest/v1/products?... → HTTP 200 (Server/Admin Read ok)
- GET /rest/v1/efro_action_log?limit=1 → HTTP 200 (Server-only Logs ok)

Schema-Reality:
- In efro_action_log heißt die Shop-Spalte **shop** (nicht shop_domain).
- Beispiel-Row enthält u. a.: shop, correlation_id, action_type, draft_order_id, invoice_url, token_source.

Warum der vorherige SELECT kaputt war:
- Es wurde shop_domain selektiert, aber in efro_action_log heißt die Spalte shop → Fehler 42703 column ... does not exist.

## D) Claim-Reality (Policy erwartet shop_domain, fallback shop)

In supabase/migrations/20260108190000_rls_lockdown_public_tables.sql:
- RLS enabled auf efro_shops, products, efro_action_log
- revoke all ... from anon, authenticated für alle drei Tabellen (default locked)

Optionaler future-read (JWT claim) für products (authenticated) ist definiert als:
shop_domain = coalesce(auth.jwt()->>'shop_domain', auth.jwt()->>'shop')

In 20260108223000_rls_keep_efro_shops_server_only.sql:
- efro_shops bleibt server-only (authenticated SELECT revoked, Policy gedroppt)

Ergebnis:
- Claim-Name ist robust: shop_domain bevorzugt, shop fallback.

## E) Mini-Proof (optional, sauber fürs Log)

Schöner SELECT auf logs mit korrekten Spaltennamen:
set -a; source .env.local; set +a
BASE="${SUPABASE_URL%/}/rest/v1"

curl -sS -i "$BASE/efro_action_log?select=id,created_at,shop,correlation_id,action_type,ok,status_code,draft_order_id,invoice_url,token_source&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | sed -n '1,120p'
