# EFRO – Glossary & Naming Rules

Last updated: 2025-12-20
Commit (working baseline): c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70
Branch (docs update): docs/update-inventory-2025-12-20
Maintainer: Derin

## Ziel
Diese Datei verhindert Naming-Drift (Zeitkiller). Wenn ein Begriff hier anders steht als im Code → P0 Ticket.

## Canonical Begriffe (Zielzustand)
- Code (intern): shopDomain
- URL Query (extern): shop
- DB Column (Ist im Code): shop_domain
- Normalisierung: eine zentrale Funktion normalizeShopDomain(domain: string): string

## Ist-Zustand (evidence-based aus Code)
### URL Query Keys (Drift vorhanden)
1) Query: shop
- Evidence (API):
  - src/app/api/efro/products/route.ts -> searchParams.get("shop")
  - src/app/api/efro/shop-settings/route.ts -> searchParams.get("shop")
  - src/app/api/efro/shop-meta/route.ts -> searchParams.get("shop")
  - src/app/api/efro/debug-shop-meta/route.ts -> searchParams.get("shop")
  - src/app/api/efro/suggest/route.ts -> searchParams.get("shop")
  - src/app/api/verify/route.ts -> searchParams.get("shop")

2) Query: shopDomain (parallel/legacy in URLs)
- Evidence (API):
  - src/app/api/efro/events/route.ts -> searchParams.get("shopDomain")
  - src/app/api/efro/repository/shop/route.ts -> searchParams.get("shopDomain")

3) Sonderfall: shopId
- Evidence:
  - src/app/api/efro/repository/cache/route.ts -> searchParams.get("shopId")

➡️ Konsequenz:
- Es existieren 2 Tenant-Query-Keys: shop und shopDomain. Das muss dokumentiert und später konsolidiert werden.

### DB Feldname (shop_domain ist real)
- Evidence:
  - src/lib/efro/efroSupabaseRepository.ts -> .eq("shop_domain", normalizedDomain)
  - src/lib/shops/db.ts -> .eq("shop_domain", shopDomain)
  - src/lib/fetchWithCache.ts / fetchAudioWithCache.ts -> .eq("shop_domain", shopDomain)
  - src/lib/efro/logEventServer.ts -> schreibt shop_domain

## Normalisierung (mehrfach vorhanden → P0 Doku-Ticket)
- Lokale Normalisierung:
  - src/app/api/efro/onboard-shop/route.ts -> function normalizeShopDomain(domain: string)
- Wiederholte Normalisierung (trim/lowercase):
  - src/lib/efro/efroSupabaseRepository.ts
  - src/lib/products/efroProductLoader.ts
  - src/lib/shops/meta.ts

## Verboten / Legacy (ab jetzt nicht weiter ausbauen)
- neue Stellen, die shopDomain ohne zentrale normalizeShopDomain normalisieren
- neue Endpoints, die zusätzliche Query-Keys einführen (tenant/domain/etc.)

## P0 Empfehlung (nur Doku, kein Code-Change hier)
- extern: canonical URL key bleibt shop
- intern: shopDomain bleibt canonical im Code
- endpoints akzeptieren langfristig shop (extern) und mappen intern zu shopDomain

