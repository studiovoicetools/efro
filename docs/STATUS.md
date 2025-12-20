# EFRO – Status

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: feature/curated1000  
Maintainer: Derin

## Ziel
Diese Datei ist die einzige Einstiegstür. Wenn etwas kaputt ist, startet jeder hier.

## Go-Live Gate (muss grün sein)
- [ ] pnpm lint
- [ ] pnpm test
- [ ] pnpm build
- [ ] SellerBrain Scenarios: 1000/1000 (Ziel)
- [ ] Render Deploy + Healthcheck OK
- [ ] Supabase: Shop-Lookup + Products Loader OK
- [ ] Shopify Embed: Demo-Storefront lädt EFRO Widget korrekt
- [ ] Onboarding: Voice stabil, LipSync (falls aktiv) stabil
- [ ] Event Logs: Operator-Sicht vorhanden (Debug/Trace)

## Fakten (Inventur – Code-basiert)
- Branch: feature/curated1000
- Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70
- API Routes (Next.js App Router): 40  (Quelle: git ls-files src/app/api/**/route.ts)

## Navigation (Single Source of Truth Links)
- System Map: SYSTEM_MAP.md
- Schnittstellen/API/Webhooks: INTERFACES.md
- Begriffe/Naming (shop/domain): GLOSSARY.md
- Supabase / DB / Keys (nur Namen): SUPABASE.md
- Deploy & Betrieb (Render): RENDER_OPS.md
- Shopify Embed: SHOPIFY_EMBED.md
- Onboarding / Voice / LipSync / MascotBot: ONBOARDING.md
- Landingpage Regeln: LANDINGPAGE.md
- Testing & Suites (388/1000): TESTING.md
- Offene Baustellen: OPEN_TICKETS.md

## Nächste Schritte (P0 → P2)
### P0 (Go-Live Blocker)
1) INTERFACES.md: Methods + Input/Output + Auth pro Route aus Code extrahieren (keine Annahmen).
2) GLOSSARY.md: shop/domain/tenant Begriffe normieren + Legacy-Fundstellen listen.
3) TESTING.md: Exakte Befehle für 388/1000 aus package.json scripts dokumentieren.

### P1 (Profi-Seller)
- Operator Log-Sicht: Events/Debug verlässlich & auffindbar.
- Shopify Embed: stabile Demo-Storefront Integration + Domain Handling.

### P2 (Nice-to-have)
- Landing polish + Panda Preview + Safe-Area Regeln final.
