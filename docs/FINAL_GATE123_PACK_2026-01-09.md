# EFRO – FINAL Gate-1/2/3 Doku Pack (Stand: 2026-01-09, Europe/Istanbul)

## Kontext (Single Source of Truth)

Repo: ~/work/efro_work_fixed  
Branch (Work): wip/gate3-oauth-min-e2e  
SSOT-Branch (Docs): chore/docs-reset-20260104  
Prod Base: https://app.avatarsalespro.com  
Test-Shop: avatarsalespro-dev.myshopify.com

## Production Build Proof (welcher Code läuft wirklich live?)

Endpoint:
GET https://app.avatarsalespro.com/api/build

Observed Output (Beleg):
- NODE_ENV=production
- node=v20.19.5
- RENDER_GIT_COMMIT=9bda27331e78cb52b8d27060fd4990bc1d02bf7e

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
- (indirekt relevant) public.efro_action_log (Gate-2 Audit, später)

### ENV (server)
- SHOPIFY_API_SECRET (HMAC)
- SUPABASE_URL, SUPABASE_SERVICE_KEY
- shop=<myshopify-domain>

### Gate-3 Proof (deine Outputs)

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
- Format bewahrt (Absätze via \n\n),
- productsSource sauber liefert (hier: supabase_products),
- productCount plausibel.

### Proof (deine Outputs)
Observed Output (Beleg):
- productsSource: "supabase_products"
- productCount: 130
- Mojibake Check: OK: no mojibake patterns
- Paragraph Check: contains \n\n: True
- aiTrigger.needsAiHelp: false

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
- CREATE_DRAFT_ORDER_CHECKOUT erfolgreich ausführt (DraftOrderId + invoiceUrl),
- Idempotency zuverlässig ist: gleiche correlationId → gleicher DraftOrder + invoiceUrl beim Retry,
- Audit-Logging vorhanden ist (efro_action_log), inkl. Token-Source (server-intern).

### Relevante Schnittstellen / Contracts
Endpoint:
POST /api/efro/commerce/action

Audit:
public.efro_action_log (Server/Admin Read), relevante Spalten u.a.:
- shop (Spalten-Reality!)
- correlation_id
- action_type
- ok
- status_code
- draft_order_id
- invoice_url
- token_source

Wichtig:
- In efro_action_log heißt die Shop-Spalte shop (nicht shop_domain).

### Proof (deine Outputs)
Create:
- correlationId: gate2-doc-20260109-225219
- draftOrderId: gid://shopify/DraftOrder/1087720718403
- invoiceUrl: .../invoices/bde8cf2d...
- status: OPEN

Retry (same CID):
- gleicher draftOrderId
- gleiche invoiceUrl
- status: OPEN

Audit Log Proof (Service-Role):
- GET /rest/v1/efro_action_log?... → HTTP 200
Beispiel-Row zeigt u.a.:
- shop:"avatarsalespro-dev.myshopify.com"
- correlation_id:"gate2-idem2-20260107-203958"
- action_type:"CREATE_DRAFT_ORDER_CHECKOUT"
- status_code:200
- token_source:"supabase.shops.access_token"

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

# Audit Read (Service-Role, “nice select”)
set -a; source .env.local; set +a
BASE="${SUPABASE_URL%/}/rest/v1"

curl -sS -i "$BASE/efro_action_log?select=id,created_at,shop,correlation_id,action_type,ok,status_code,draft_order_id,invoice_url,token_source&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" | sed -n '1,120p'

---

## Security Appendix ✅ (RLS No-Leak + Service-Role Proof)

Siehe: docs/POST_RLS_PROOF_SSOT_2026-01-09.md

Kurzfazit:
- anon/auth bekommt keine Tokens/Logs (No-Leak)
- Service-Role kann Logs lesen (Server-only Logs funktionieren)
- Claim/Column-Reality dokumentiert (shop vs shop_domain, shop_domain fallback shop)

---

## Ergebnis (Finale Gate-Status)

Gate-1: ✅ GRÜN  
Gate-2: ✅ GRÜN  
Gate-3: ✅ GRÜN  

Prod-Commit eindeutig: ✅ /api/build zeigt RENDER_GIT_COMMIT=9bda273...

---

## Was als nächstes noch offen ist (nur Liste)

- Hardcore v2 Testpaket (Katalog-Realismus + Chaos: Typos, Mixed-Language, Budget-Fallen, Konflikte, Long-context, Policy/FAQ-Fragen, Null-Katalog, Vergleiche)
- UI Runtime Smoke im echten Browser (Widget/Avatar/Lipsync/Console Errors) – rein als Go/No-Go UX-Beleg
- Monitoring/Alerting (Error Tracking, Rate-Limits, Abuse-Guard, SLO-Checks)
- Sync-Vollständigkeit (topics erweitern: products/delete, GDPR, evtl. bulk resync/cron)
- Billing/Commercial (Pricing-Plan-Limits wirklich enforced, Install→Plan→Limits sauber)
