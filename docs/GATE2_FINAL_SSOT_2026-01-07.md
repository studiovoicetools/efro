# EFRO – Gate-2 FINAL SSOT Proof (2026-01-07)

Datum/Stand: 2026-01-07 (Europe/Istanbul)
PROD Base URL: https://app.avatarsalespro.com
Test-Shop: avatarsalespro-dev.myshopify.com

## A) Live/Build Proof (PROD)

Command:
curl -s https://app.avatarsalespro.com/api/build; echo

Observed Output:
{"ok":true,"now":"2026-01-07T17:33:57.801Z","node":"v20.19.5","env":{"NODE_ENV":"production","RENDER_GIT_COMMIT":"4fcb7e8b70321e8f7e3ce78d782925184d403822","VERCEL_GIT_COMMIT_SHA":null,"GITHUB_SHA":null}}

## B) Gate-2 Contract / API

Endpoint (PROD):
POST /api/efro/commerce/action

Actions:
- CREATE_DRAFT_ORDER_CHECKOUT
- UPDATE_DRAFT_ORDER_LINE_QTY

Token-Quelle (intern geloggt; nicht im normalen Response):
supabase.shops.access_token

## C) Proof Runs (Real Shopify Data)

### C1) Create Draft Order (ein Call) ✅

Observed Response:
{
  "ok": true,
  "shop": "avatarsalespro-dev.myshopify.com",
  "correlationId": "gate2-final-create-20260107-203453",
  "actionType": "CREATE_DRAFT_ORDER_CHECKOUT",
  "result": {
    "draftOrderId": "gid://shopify/DraftOrder/1087368953923",
    "status": "OPEN",
    "invoiceUrl": "https://avatarsalespro-dev.myshopify.com/66077720643/invoices/1cd3a79b433f53a05504f034d5571659"
  }
}

### C2) Idempotency Replay (First + Retry) ✅

First call:
{
  "ok": true,
  "shop": "avatarsalespro-dev.myshopify.com",
  "correlationId": "gate2-idem2-20260107-203958",
  "actionType": "CREATE_DRAFT_ORDER_CHECKOUT",
  "result": {
    "draftOrderId": "gid://shopify/DraftOrder/1087370264643",
    "status": "OPEN",
    "invoiceUrl": "https://avatarsalespro-dev.myshopify.com/66077720643/invoices/d0deef8746d5d5685c2e39e05f43ed63"
  }
}

Retry (same correlationId):
{
  "ok": true,
  "shop": "avatarsalespro-dev.myshopify.com",
  "correlationId": "gate2-idem2-20260107-203958",
  "actionType": "CREATE_DRAFT_ORDER_CHECKOUT",
  "result": {
    "status": "OPEN",
    "invoiceUrl": "https://avatarsalespro-dev.myshopify.com/66077720643/invoices/d0deef8746d5d5685c2e39e05f43ed63",
    "draftOrderId": "gid://shopify/DraftOrder/1087370264643"
  }
}

## D) Optional DB Proof (efro_action_log)

Für correlation_id = "gate2-idem2-20260107-203958" war der DB-Eintrag:
{
  "created_at": "2026-01-07T17:39:59.049533+00:00",
  "shop": "avatarsalespro-dev.myshopify.com",
  "correlation_id": "gate2-idem2-20260107-203958",
  "action_type": "CREATE_DRAFT_ORDER_CHECKOUT",
  "ok": true,
  "status_code": 200,
  "draft_order_id": "gid://shopify/DraftOrder/1087370264643",
  "invoice_url": "https://avatarsalespro-dev.myshopify.com/66077720643/invoices/d0deef8746d5d5685c2e39e05f43ed63",
  "duration_ms": 722,
  "token_source": "supabase.shops.access_token"
}

## E) Gate-2 Status

Gate-2: FINAL GRÜN ✅

Begründung:
- PROD Build ist belegt (RENDER_GIT_COMMIT=4fcb7e8…)
- CREATE_DRAFT_ORDER_CHECKOUT liefert draftOrderId + invoiceUrl
- Idempotency ist belegt: gleicher correlationId → gleicher draftOrderId/invoiceUrl (Retry)
- Optional: Audit-Log Eintrag in efro_action_log belegt Korrelation + Result
