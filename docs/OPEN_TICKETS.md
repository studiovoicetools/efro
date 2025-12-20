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
