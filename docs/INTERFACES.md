# EFRO – Interfaces (API Routes, Webhooks, Integrationen)

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: feature/curated1000  
Maintainer: Derin

## Harte Regeln
- Keine Annahmen: Method, Input/Output, Auth werden aus Code abgeleitet.
- Keine Secrets: niemals Values aus .env, nur Env-Var Namen.
- Tenant/Shop Begriffe müssen normiert werden (siehe GLOSSARY.md).

## API Routes (Inventur – Quelle: git ls-files src/app/api/**/route.ts)
Hinweis: Purpose/Method/Auth werden in Phase 2 aus dem Code ergänzt.

| Route (URL) | Gruppe | Method | Auth/Tenant | Contract (Input → Output) | Source file |
|---|---|---:|---|---|---|
| /api/billing | Billing | TODO | TODO | TODO | src/app/api/billing/route.ts |
| /api/subscriptions | Billing | TODO | TODO | TODO | src/app/api/subscriptions/route.ts |
| /api/checkout/url | Billing | TODO | TODO | TODO | src/app/api/checkout/url/route.ts |
| /api/verify | Billing | TODO | TODO | TODO | src/app/api/verify/route.ts |
| /api/cart/add | Commerce | TODO | TODO | TODO | src/app/api/cart/add/route.ts |
| /api/cross-sell | Commerce | TODO | TODO | TODO | src/app/api/cross-sell/route.ts |
| /api/demo-products | Demo | TODO | TODO | TODO | src/app/api/demo-products/route.ts |
| /api/landing-chat | Landing | TODO | TODO | TODO | src/app/api/landing-chat/route.ts |
| /api/health | Ops | TODO | TODO | TODO | src/app/api/health/route.ts |
| /api/get-realtime-token | Voice/Media | TODO | TODO | TODO | src/app/api/get-realtime-token/route.ts |
| /api/get-signed-url | Voice/Media | TODO | TODO | TODO | src/app/api/get-signed-url/route.ts |
| /api/get-signed-url-seller | Voice/Media | TODO | TODO | TODO | src/app/api/get-signed-url-seller/route.ts |
| /api/eleven-offer | Voice/Media | TODO | TODO | TODO | src/app/api/eleven-offer/route.ts |
| /api/convai/offer | Voice/Media | TODO | TODO | TODO | src/app/api/convai/offer/route.ts |
| /api/explain-product | AI/Assist | TODO | TODO | TODO | src/app/api/explain-product/route.ts |
| /api/sellerbrain-ai | AI/Assist | TODO | TODO | TODO | src/app/api/sellerbrain-ai/route.ts |
| /api/efro/suggest | EFRO Core | TODO | TODO | TODO | src/app/api/efro/suggest/route.ts |
| /api/efro/products | EFRO Core | TODO | TODO | TODO | src/app/api/efro/products/route.ts |
| /api/efro/shops | EFRO Core | TODO | TODO | TODO | src/app/api/efro/shops/route.ts |
| /api/efro/shop-settings | EFRO Core | TODO | TODO | TODO | src/app/api/efro/shop-settings/route.ts |
| /api/efro/shop-meta | EFRO Core | TODO | TODO | TODO | src/app/api/efro/shop-meta/route.ts |
| /api/efro/debug-shop-meta | EFRO Debug | TODO | TODO | TODO | src/app/api/efro/debug-shop-meta/route.ts |
| /api/efro/debug-products | EFRO Debug | TODO | TODO | TODO | src/app/api/efro/debug-products/route.ts |
| /api/efro/onboard-shop | EFRO Onboarding | TODO | TODO | TODO | src/app/api/efro/onboard-shop/route.ts |
| /api/efro/voice-preview | EFRO Voice | TODO | TODO | TODO | src/app/api/efro/voice-preview/route.ts |
| /api/efro/events | EFRO Events | TODO | TODO | TODO | src/app/api/efro/events/route.ts |
| /api/efro/log-event | EFRO Events | TODO | TODO | TODO | src/app/api/efro/log-event/route.ts |
| /api/efro/ai-unknown-terms | EFRO AI | TODO | TODO | TODO | src/app/api/efro/ai-unknown-terms/route.ts |
| /api/efro/admin/update-plan | EFRO Admin | TODO | TODO | TODO | src/app/api/efro/admin/update-plan/route.ts |
| /api/efro/repository/shop | EFRO Repo | TODO | TODO | TODO | src/app/api/efro/repository/shop/route.ts |
| /api/efro/repository/products | EFRO Repo | TODO | TODO | TODO | src/app/api/efro/repository/products/route.ts |
| /api/efro/repository/cache | EFRO Repo | TODO | TODO | TODO | src/app/api/efro/repository/cache/route.ts |
| /api/shopify-import | Shopify | TODO | TODO | TODO | src/app/api/shopify-import/route.ts |
| /api/shopify-products | Shopify | TODO | TODO | TODO | src/app/api/shopify-products/route.ts |
| /api/shopify-webhook | Shopify | TODO | TODO | TODO | src/app/api/shopify-webhook/route.ts |
| /api/shopify/callback | Shopify | TODO | TODO | TODO | src/app/api/shopify/callback/route.ts |
| /api/webhooks/app-uninstalled | Shopify/Webhooks | TODO | TODO | TODO | src/app/api/webhooks/app-uninstalled/route.ts |
| /api/webhooks/gdpr/customer-redact | Shopify/Webhooks | TODO | TODO | TODO | src/app/api/webhooks/gdpr/customer-redact/route.ts |
| /api/supabase-products | Supabase | TODO | TODO | TODO | src/app/api/supabase-products/route.ts |
| /api/supabase/sync-schema | Supabase | TODO | TODO | TODO | src/app/api/supabase/sync-schema/route.ts |

## Webhooks (werden aus Code ergänzt)
- Shopify Webhooks: /api/shopify-webhook, /api/webhooks/*
- Signature/Verification: TODO (aus Code)

## Externe Integrationen (werden aus Code ergänzt)
- Supabase
- Shopify
- Stripe/Billing
- ElevenLabs / Voice
- MascotBot/Rive

## Phase 2: Wie wir Methods/Contracts automatisch extrahieren (Commands)
Siehe unten in diesem Chat (nächster Schritt).
