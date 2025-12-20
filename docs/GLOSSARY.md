# EFRO – Glossary & Naming Rules

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: feature/curated1000  
Maintainer: Derin

## Canonical Regeln (müssen eingehalten werden)
- Code: shopDomain
- URL Query: shop
- DB Column: domain
- Legacy verboten: shop-domain, shop_domain im Code, parallele Query keys (shop+domain)

## Fundstellen (werden per Scan ergänzt)
TODO: Liste der gefundenen Varianten + Dateipfade.

## Normalisierung (Single Source of Truth)
TODO: normalizeShopDomain() Fundstelle + Regeln (lowercase, ohne protocol, trim, etc.)
