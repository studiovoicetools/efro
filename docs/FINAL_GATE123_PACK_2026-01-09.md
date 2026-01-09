# EFRO – FINAL Gate-1/2/3 Doku Pack (2026-01-09)

Stand: 2026-01-09 (Europe/Istanbul)

## Kontext (Single Source of Truth)

Repo: ~/work/efro_work_fixed  
SSOT Branch: chore/docs-reset-20260104  
Work Branch: wip/gate3-oauth-min-e2e  
Prod Base: https://app.avatarsalespro.com  
Test-Shop: avatarsalespro-dev.myshopify.com

Hinweis:
- Reproduzierbare Belege / Proofs sind als Outputs und Copy/Paste Commands dokumentiert.
- Security/RLS Appendix ist separat dokumentiert: `docs/POST_RLS_PROOF_SSOT_2026-01-09.md`.

---

## Production Build Proof (welcher Code läuft live?)

Endpoint:
GET https://app.avatarsalespro.com/api/build

Observed Output:
{"ok":true,"now":"2026-01-09T??:??:??.???.Z","node":"v20.19.5","env":{"NODE_ENV":"production","RENDER_GIT_COMMIT":"9bda27331e78cb52b8d27060fd4990bc1d02bf7e","VERCEL_GIT_COMMIT_SHA":null,"GITHUB_SHA":null}}

Ergebnis:
- NODE_ENV=production
- node=v20.19.5
- RENDER_GIT_COMMIT=9bda273... (Prod-Stand auf Render ist eindeutig)

Copy/Paste Proof:
curl -s https://app.avatarsalespro.com/api/build; echo

---

## Gate-3 ✅ GRÜN (OAuth + Webhooks + Token-Truth + Persistenz)

### Ziel / Done Definition
Gate-3 ist GRÜN, wenn EFRO in Production mit einem echten Shopify-Shop:
- Webhooks korrekt entgegennimmt und in Supabase persistiert (E2E),
- app/uninstalled sauber behandelt (Token/Status invalidiert),
- Shopify live lesen kann mit Token aus Supabase (kein ENV/Legacy-Fallback).

### Relevante Schnittstellen / Endpoints (Prod)
- GET /api/build
- POST /api/shopify-webhook
- GET /api/shopify-products?shop=...

### Supabase Tables
- public.products (Webhook Writes)
- public.efro_shops (Token/Scopes/Status)
- (indirekt) public.efro_action_log (Gate-2 Audit)

### ENV (server)
- SHOPIFY_API_SECRET (HMAC)
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- shop=<myshopify-domain>

### Gate-3 Proof (Outputs)
(1) Webhook E2E: products/update → Supabase products ✅  
Script: scripts/smoke-shopify-webhook.ts  
Evidence:
- topic: products/update
- HTTP 200
- response: {"ok":true,"topic":"products/update","action":"insert","mode":"shop_sku"}

Supabase Verify:
- found: 1
- row enthält u.a.:
  - sku: SMOKE-2026-01-09-1767988327129
  - shop_domain: avatarsalespro-dev.myshopify.com
  - shop_uuid: b4cbd96d-b0f1-4a39-9021-b276a4302a76

(2) Uninstall Handling: app/uninstalled invalidiert Token/Status ✅  
Script: scripts/smoke-shopify-uninstall.ts  
Evidence:
- HTTP 200
- response: {"ok":true,"topic":"app/uninstalled","action":"uninstalled"}
Verify:
- access_token: null
- onboarding_status: "uninstalled"

(3) Shopify Live Read via Token aus Supabase ✅  
Endpoint:
GET https://app.avatarsalespro.com/api/shopify-products?shop=avatarsalespro-dev.myshopify.com  
Observed Output:
- source: "shopify-admin"
- tokenSource: "shops"
- tokenUpdatedAt: "2026-01-08T16:51:55.814+00:00"
- products list wird geliefert

Ergebnis:
Gate-3 ist GRÜN: Webhook→Supabase, Uninstall invalidation, Live Read mit Token aus efro_shops.

### Gate-3 Copy/Paste Proof Commands
# 1) Prod Build Proof
curl -s https://app.avatarsalespro.com/api/build; echo

# 2) Webhook products/update Smoke + Supabase Verify
set -a; source .env.local; set +a
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-webhook.ts \
  --base=https://app.avatarsalespro.com \
  --shop=avatarsalespro-dev.myshopify.com \
  --topic=products/update

# 3) Uninstall Smoke (Fake shop row + invalidation verify)
NODE_TLS_REJECT_UNAUTHORIZED=0 pnpm -s tsx scripts/smoke-shopify-uninstall.ts \
  --base=https://app.avatarsalespro.com

# 4) Live Shopify Read Proof
curl -s "https://app.avatarsalespro.com/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" \
  | python3 -m json.tool | head -n 80

---

## Gate-1 ✅ GRÜN (Suggest: Repo-Load, Format, Encoding, Normalisierung)

### Ziel / Done Definition
Gate-1 ist GRÜN, wenn /api/efro/suggest in PROD:
- Produkte über Repository lädt (kein Self-Fetch zu /api/efro/products),
- replyText ohne Mojibake ausgibt,
- Format bewahrt (Absätze via \\n\\n),
- productsSource sauber liefert (hier: supabase_products),
- productCount plausibel.

### Relevante Schnittstellen
Endpoint:
GET /api/efro/suggest?shop=...&text=...

### Gate-1 Proof (Outputs)
Observed Output:
- productsSource: "supabase_products"
- productCount: 130
- Mojibake Check: OK (keine typischen Patterns)
- Paragraph Check: enthält \\n\\n = True
- aiTrigger.needsAiHelp: false

Ergebnis:
Gate-1 ist GRÜN: repo-load, no mojibake, \\n\\n, source/count.

### Gate-1 Copy/Paste Proof Commands
OUT="/tmp/gate1_suggest_$(date +%s).json"

curl -sS \
"https://app.avatarsalespro.com/api/efro/suggest?shop=avatarsalespro-dev.myshopify.com&text=zeige%20mir%20etwas%20unter%20100%20euro&nonce=$(date +%s)" \
| tee "$OUT" | head -c 2600; echo

echo "=== CHECK: mojibake / broken umlauts ==="
rg -n 'f�r|m�chtest|Zubeh�r|Ã|â€|�' "$OUT" && echo "ERROR: still broken" || echo "OK: no mojibake patterns"

echo "=== CHECK: paragraphs \\n\\n + source/count ==="
python3 - <<'PY'
import json,glob
p=sorted(glob.glob("/tmp/gate1_suggest_*.json"))[-1]
d=json.load(open(p,"r",encoding="utf-8"))
rt=d.get("replyText","")
print("file:",p)
print("contains \\n\\n:", "\n\n" in rt)
print("productsSource:", d.get("productsSource"))
print("productCount:", d.get("productCount"))
PY

---

## Gate-2 ✅ GRÜN (Commerce Actions + Idempotency + Audit Logs)

### Ziel / Done Definition
Gate-2 ist GRÜN, wenn EFRO in PROD:
- CREATE_DRAFT_ORDER_CHECKOUT erfolgreich ausführt (draftOrderId + invoiceUrl),
- Idempotency zuverlässig ist: gleiche correlationId → gleicher draftOrderId + invoiceUrl beim Retry,
- Audit-Logging vorhanden ist (efro_action_log), inkl. token_source (server-intern).

### Relevante Schnittstellen / Contracts
Endpoint:
POST /api/efro/commerce/action

Audit:
public.efro_action_log (Server/Admin Read)

Schema-Reality:
- In efro_action_log heißt die Shop-Spalte **shop** (nicht shop_domain).

### Gate-2 Proof (Outputs)
Create (PROD):
- correlationId: gate2-doc-20260109-225219
- draftOrderId: gid://shopify/DraftOrder/1087720718403
- invoiceUrl: .../invoices/bde8cf2d...
- status: OPEN

Retry (same correlationId):
- gleicher draftOrderId
- gleiche invoiceUrl
- status: OPEN

Audit Log Proof (Service-Role):
- GET /rest/v1/efro_action_log?... → HTTP 200
Beispiel-Row:
- shop:"avatarsalespro-dev.myshopify.com"
- correlation_id:"gate2-idem2-20260107-203958"
- action_type:"CREATE_DRAFT_ORDER_CHECKOUT"
- status_code:200
- token_source:"supabase.shops.access_token"

Ergebnis:
Gate-2 ist GRÜN: Create + Idempotency + Audit Log vorhanden, Service-Role kann lesen.

### Gate-2 Copy/Paste Proof Commands
CID_RETRY="gate2-doc-$(date +%Y%m%d-%H%M%S)"

echo "=== Create ==="
curl -sS -X POST "https://app.avatarsalespro.com/api/efro/commerce/action" \
  -H "content-type: application/json" \
  -d '{
    "shop":"avatarsalespro-dev.myshopify.com",
    "correlationId":"'"$CID_RETRY"'",
    "action":{"type":"CREATE_DRAFT_ORDER_CHECKOUT","variantId":"gid://shopify/ProductVariant/42724704944195","quantity":1}
  }' | python3 -m json.tool

echo
echo "=== Retry (same correlationId) ==="
curl -sS -X POST "https://app.avatarsalespro.com/api/efro/commerce/action" \
  -H "content-type: application/json" \
  -d '{
    "shop":"avatarsalespro-dev.myshopify.com",
    "correlationId":"'"$CID_RETRY"'",
    "action":{"type":"CREATE_DRAFT_ORDER_CHECKOUT","variantId":"gid://shopify/ProductVariant/42724704944195","quantity":1}
  }' | python3 -m json.tool

# Audit Read (Service-Role)
set -a; source .env.local; set +a
BASE="${SUPABASE_URL%/}/rest/v1"

curl -sS -i "$BASE/efro_action_log?select=id,created_at,shop,correlation_id,action_type,ok,status_code,draft_order_id,invoice_url,token_source&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | sed -n '1,120p'

---

## Security Appendix ✅ (RLS No-Leak + Service-Role Proof)

Siehe: `docs/POST_RLS_PROOF_SSOT_2026-01-09.md`

Kurzfazit:
- anon/auth darf weder efro_shops noch efro_action_log lesen (No-Leak)
- Service-Role kann efro_action_log lesen (Server-only Logs funktionieren)
- Spalten-Reality: efro_action_log.shop (nicht shop_domain)

---

## Finaler Gate-Status (2026-01-09)

- Gate-1: ✅ GRÜN
- Gate-2: ✅ GRÜN
- Gate-3: ✅ GRÜN

---

## Nächste offene Punkte (nur Liste)

- Hardcore v2 Testpaket (Typos, Mixed-Language, Budget-Fallen, Konflikte, Long-context, Policy/FAQ, Null-Katalog, Vergleiche)
- UI Runtime Smoke im echten Browser (Widget/Avatar/Lipsync/Console Errors) als Go/No-Go UX-Beleg
- Monitoring/Alerting (Error Tracking, Rate-Limits, Abuse-Guard, SLO-Checks)
- Sync-Vollständigkeit (topics: products/delete, GDPR, ggf. bulk resync/cron)
- Billing/Commercial (Plan-Limits wirklich enforced, Install→Plan→Limits)
