# EFRO – System Map (Master Map)

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: feature/curated1000  
Maintainer: Derin

## Ziel
Diese Datei ist die Landkarte: Wer ruft was auf, wo liegt der Code, welche Abhängigkeiten existieren.

## Oberflächen (Entry Points)
- Landingpage (Marketing + Demo-Einstiege)
- EFRO Widget (floating, bottom-right)
- Shopify Storefront (Embed-Ziel)
- Onboarding (Voice/LipSync/MascotBot Flow)

## API Layer (App Router)
Quelle: src/app/api/**/route.ts (40 Routen)
- Health: /api/health
- EFRO Core: /api/efro/*
- Repository/Cache: /api/efro/repository/*
- Events/Logging: /api/efro/events, /api/efro/log-event
- Shopify: /api/shopify*, /api/shopify/callback, /api/shopify-webhook, /api/webhooks/*
- Billing/Subscriptions: /api/billing, /api/subscriptions, /api/checkout/url, /api/verify
- Sellerbrain AI: /api/sellerbrain-ai, /api/efro/suggest, /api/explain-product
- Media/Voice: /api/efro/voice-preview, /api/get-signed-url*, /api/get-realtime-token, /api/eleven-offer
- Supabase Tools: /api/supabase-products, /api/supabase/sync-schema
- Commerce: /api/cart/add, /api/cross-sell

## Datenfluss (High-Level)
User → Widget/Chat/Voice → API Routes → SellerBrain/Repository → Supabase/Shopify → Reply → Events/Logs → UI

## Tenant / Shop Truth (muss normiert werden)
Canonical Regeln (werden in GLOSSARY.md finalisiert):
- Code: shopDomain
- URL Query: shop
- DB Column: domain
- Eine zentrale Normalisierung (normalizeShopDomain) – Fundstelle wird per Scan ergänzt.

## Datenquellen
- Supabase (Products, Shops, Settings) – Details in SUPABASE.md
- Shopify (Import/Products/Webhooks/Callback) – Details in SHOPIFY_EMBED.md + INTERFACES.md

## Observability / Events
- Event Endpoints existieren: /api/efro/events, /api/efro/log-event (Contracts folgen aus Code)
- Ziel: Operator-Sicht (Debug/Trace) dokumentiert in ONBOARDING.md + INTERFACES.md

## Where in code? (wird durch Inventur ergänzt)
- SellerBrain Orchestrator/Module: TODO (per rg im lib/ Ordner)
- Supabase Repository/Loader: TODO
- Widget UI: TODO
- Landing UI: TODO
