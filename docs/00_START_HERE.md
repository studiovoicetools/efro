Projektbasis (aktuell ausgecheckt):
- Branch: docs/update-inventory-2025-12-20 (Docs-Update-Branch)
- Arbeitsbasis: feature/curated1000 (Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70)

Last-known-good:
- Tag/Referenz: stable/1000pass-20251218_010858 (laut Doku)

Schnellstart (lokal)
- pnpm install
- pnpm dev
- pnpm sellerbrain:scenarios   # immer ausführen; bei Fail: failing sections posten

Tests / CI (Doku)
- Core tests: 388 (historisch)
- EFRO scenario target: 1000 (Env: EFRO_SCENARIO_TARGET)

Deploy
- Hosting: Render
- Produkte/Shop-Data: Supabase

Arbeitsregel
- minimal-invasive Änderungen
- vor PR/Push immer sellerbrain-Szenarien ausführen
- Evidence-first: bei Bugs immer File+Zeilenbereich zeigen (rg-Ausgabe)
