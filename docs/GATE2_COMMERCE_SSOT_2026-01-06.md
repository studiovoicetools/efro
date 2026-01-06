# EFRO – Gate-2 Commerce Actions (SSOT Proof) – 2026-01-06

Stand: 2026-01-06 (Europe/Istanbul)

Regel: Gate-2 ist nur dann **GRÜN**, wenn echte **Production Proof-Runs** (Command + Output) dokumentiert sind.

## A) Ziel / Definition (Gate-2 = GRÜN)

Gate-2 ist GRÜN, wenn EFRO in **Production** zuverlässig folgende transaktionale Aktionen ausführen kann:

1) `CREATE_DRAFT_ORDER_CHECKOUT`
- erstellt Draft Order + liefert `draftOrderId` + `invoiceUrl`

2) `UPDATE_DRAFT_ORDER_LINE_QTY`
- aktualisiert Menge eines Line Items (`lineItemUuid`) in einer bestehenden Draft Order

Scope: Gate-2 beweist **Actions**, nicht “Admin-Browsing”.

## B) System / Umgebung (SSOT)

Repo: `~/work/efro_work_fixed`  
Prod Base URL: `https://app.avatarsalespro.com`  
Test-Shop: `avatarsalespro-dev.myshopify.com`  
Endpoint: `POST /api/efro/commerce/action`  

Admin GraphQL: `https://{shop}/admin/api/{ADMIN_VERSION}/graphql.json`  
ADMIN_VERSION (Code): `2024-07` (`src/app/api/efro/commerce/action/route.ts`)  
Token-Quelle (belegt): `supabase.shops.access_token`

## C) Contract (Types)

Datei: `src/lib/efro/commerce/commerceTypes.ts`

Request:
- `shop` (myshopify domain)
- `correlationId` (optional)
- `action` (CommerceAction)

Response:
- `ok`, `shop`, `correlationId`, `actionType`
- `result` (z.B. `tokenSource`, `draftOrderId`, `status`, `invoiceUrl`, `updatedLineItemUuid`, `quantity`)
- `error` bei Fehlern

## D) Production Build Proof

Endpoint:
- `GET https://app.avatarsalespro.com/api/build`

Pass:
- HTTP 200
- `RENDER_GIT_COMMIT` ist gesetzt

Observed (Beleg hier eintragen):
- `RENDER_GIT_COMMIT = 055887f4bc88abe6cb8943414d97459047f9aa4c`

## E) Proof Runs (Production, real Shopify data)

### E1) CREATE_DRAFT_ORDER_CHECKOUT ✅

Command (Prod):
- `curl -sS -X POST "https://app.avatarsalespro.com/api/efro/commerce/action" -H "content-type: application/json" -d '{ ... }' | python3 -m json.tool`

Request (Beispiel):
- `shop`: `avatarsalespro-dev.myshopify.com`
- `action.type`: `CREATE_DRAFT_ORDER_CHECKOUT`
- `variantId`: `gid://shopify/ProductVariant/42724704944195`
- `quantity`: `1`

Pass:
- `ok=true`
- `draftOrderId` gesetzt
- `invoiceUrl` gesetzt
- `tokenSource = "supabase.shops.access_token"`

Observed (Beleg hier einfügen, redacted ok):
- `draftOrderId: gid://shopify/DraftOrder/1087246598211`
- `status: OPEN`
- `invoiceUrl: https://avatarsalespro-dev.myshopify.com/.../invoices/...`
- `tokenSource: supabase.shops.access_token`

### E2) UPDATE_DRAFT_ORDER_LINE_QTY ✅

Vorab: Validation/Debug-Assist (erwartetes Verhalten)
- ohne `lineItemUuid` → `Invalid 'lineItemUuid'`
- falsche UUID → `lineItemUuid not found` + `knownUuids: [...]`

Finaler Proof (Prod):
- `action.type`: `UPDATE_DRAFT_ORDER_LINE_QTY`
- `draftOrderId`: `gid://shopify/DraftOrder/1087246598211`
- `lineItemUuid`: `a0a27170-eb6b-4b44-8f52-afb1a1bf6b8d`
- `quantity`: `2`

Pass:
- `ok=true`
- `updatedLineItemUuid` korrekt
- `quantity=2`
- `invoiceUrl` bleibt gültig

Observed (Beleg hier einfügen, redacted ok):
- `status: OPEN`
- `updatedLineItemUuid: a0a27170-eb6b-4b44-8f52-afb1a1bf6b8d`
- `quantity: 2`

## F) Abschlussstatement

Gate-2 ist **GRÜN**, weil beide Actions (Create + Update) in **Production** mit realen Shopify Daten erfolgreich bewiesen wurden (DraftOrder ID + invoiceUrl + Update).

## G) Thema: GraphQL `draftOrder(id)` Root-Query – Problem & Einordnung

Problem:
Eine manuelle Root-Query kann scheitern mit:
- `Access denied for draftOrder field. Required access: read_draft_orders …`

Einordnung:
- Das ist **kein Gate-2-Blocker**, weil Gate-2 Actions beweist, nicht Browsing.
- EFRO kann ggf. über `node(id) { ... on DraftOrder { ... } }` arbeiten (nicht identisch zur Root-Query).

## H) Gate-2+ (optional, wenn du Root-Query auch freischalten willst)

Wenn du zusätzlich willst, dass `draftOrder(id)` als Root-Query funktioniert:
1) OAuth Scopes enthalten `read_draft_orders` + `write_draft_orders`
2) Shop **neu autorisieren** (Re-Install), damit neuer Token mit neuen Scopes ausgestellt wird
3) `/admin/oauth/access_scopes.json` muss diese Scopes listen
