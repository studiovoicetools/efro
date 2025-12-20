# EFRO – Tenant/Shop Normalization (P0)

Stand: 2025-12-20  
Branch: docs/update-inventory-2025-12-20

## Ziel (Single Source of Truth)
Extern (URLs): `shop`  
Intern (Code): `shopDomain` (normalized)  
DB: `shop_domain` (normalized)

## Ist-Zustand (Drift, evidence-based)
- Viele Endpoints nutzen Query shop
- Einige Endpoints nutzen Query shopDomain
- Ein Sonderfall nutzt Query shopId (Repository Cache)

Risiko:
- Bugs durch falschen Tenant-Key
- Doku/Code driftet auseinander
- Zeitkiller bei Debugging (welcher Key gilt wo?)

## Canonical Rules (ab sofort)
1) Extern (Public API): canonical Query-Key ist shop
2) Intern (Server/Code): wir arbeiten ausschließlich mit shopDomain (normalized)
3) Persistenz: DB-Feld ist shop_domain
4) Normalisierung: genau 1 Funktion 
`normalizeShopDomain(domain: string): string` (zentral, wiederverwendet)

## Übergangsregel (Backward Compatibility)
- Endpoints dürfen TEMPORÄR zusätzlich shopDomain akzeptieren,
  müssen aber intern auf shopDomain mappen und normalisieren.
- Keine neuen Tenant-Keys einführen.

## Sonderfall shopId
- shopId bleibt isoliert für repository/cache (technischer Key).
- Niemals als Public Tenant-Key verwenden.
- Wenn möglich später ablösen/ersetzen oder klar dokumentieren.

## Done-Kriterien (für spätere Code-Arbeit)
- Es gibt 1 zentrale Helper-Funktion: “getShopDomainFromRequest()”
  - akzeptiert shop (primär) und shopDomain (legacy)
  - normalisiert immer
  - liefert eindeutig shopDomain
- Alle API-Routen sind auf diese Helper-Funktion umgestellt (minimal-invasive Änderungen)
- Docs + Code sind konsistent (GLOSSARY + INTERFACES + diese Datei)
