# EFRO – Open Tickets (P0/P1/P2)

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: docs/update-inventory-2025-12-20
Maintainer: Derin

## P0 (Go-Live Blocker)
- [ ] INTERFACES.md: Methods + Contracts + Auth pro Route aus Code ergänzt
- [ ] GLOSSARY.md: shop/domain/tenant normiert + Legacy Fundstellen
- [ ] TESTING.md: Exakte 388/1000 Commands dokumentiert
- [ ] Shopify Embed: Demo-Storefront zeigt Widget stabil
- [ ] Render: Healthcheck + Logs klar

## P1 (Profi-Seller)
- [ ] Operator-Sicht: Events/Debug sauber
- [ ] Cross-sell/Cart/Checkout Flows klar dokumentiert

## P2
- [ ] Landing polish

---
## P0 – Tenant/Shop Normalization (Drift Fix)

- [ ] P0: Zentrale normalizeShopDomain() als Single Source of Truth (Code-Location festlegen)
- [ ] P0: Zentrale Helper-Funktion getShopDomainFromRequest() (shop + legacy shopDomain → shopDomain normalized)
- [ ] P0: Alle API Routes vereinheitlichen (keine neuen Tenant Keys; shopId nur intern für repo/cache)
- [ ] P0: INTERFACES.md aktualisieren: pro Route canonical tenant key + legacy acceptance (shopDomain) markieren




OPEN TICKETS (Stand: 2025-12-21)
P0 (sofort / Go-Live relevant)

Shopify Embed (Demo Storefront)

EFRO Widget unten rechts einbetten

Sicherstellen: keine Überlappung mit wichtigen UI-Elementen

Shop-Domain Handling prüfen (shop=...myshopify.com)

Onboarding → Lipsync / Mascot Conversation Flow

Ziel: Onboarding nutzt denselben stabilen Flow wie der Avatar-Chat (damit Lipsync zuverlässig ist)

Risiko: nicht „nebenbei“ refactoren → kontrolliertes Ticket

Render ENV Konsistenz

Sicherstellen, dass Render ENV sowohl im Build- als auch Runtime-Kontext verfügbar ist

Besonders: SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_SUPABASE_URL

P1 (Profi-Seller / Qualität)

Recommendation UX / Produktkarten

Produktkarten sauberer, schneller, glaubwürdiger

Ranking/Filters checken

Event Logs / Operator View

Standardisierte Events

Debug-Ansicht für Pro/Enterprise

Scenario Suite ausbauen (Curated 1000)

Ziel: deutlich mehr Testszenarien, realistische Queries

Tools existieren (scripts/test-sellerBrain-scenarios-curated.ts etc.)

P2 (Skalierung / Kosten / Monetarisierung)

Cache-System (AI + TTS)

Antwort-Cache + TTS-Cache (Credits sparen)

Knowledge Base Modul (Store Truth)

Versand/Retouren/Garantie/Zahlung/Supportzeiten

nicht als Ersatz für SellerBrain, sondern Profi-Modul

Hygiene / DevEx

Backup-Dateien / Logs / große Binärfiles

Aufräumen oder sauber ignorieren (gitignore)

Große Logs nicht dauerhaft im Repo lassen (wenn möglich)
'@ | Set-Content -Encoding UTF8 .\docs\OPEN_TICKETS.md

@'