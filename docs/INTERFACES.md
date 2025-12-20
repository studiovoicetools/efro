# EFRO – Interfaces (API Routes, Webhooks, Integrationen)

Last updated: 2025-12-20
Commit (working baseline): c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70
Branch (docs update): docs/update-inventory-2025-12-20
Maintainer: Derin

## Harte Regeln
- Keine Secrets: niemals .env Values, nur Env-Var NAMEN.
- Evidence-first: Method/Parameter werden aus Code abgeleitet, sonst TODO.
- Tenant/Shop Begriffe: siehe docs/GLOSSARY.md

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
