Projektbasis: branch "main"
Last-known-good tag: stable/1000pass-20251218_010858

Schnellstart (lokal)
- pnpm install
- pnpm dev
- pnpm sellerbrain:scenarios   # laufende SellerBrain-Szenarien (immer ausführen)

Tests / CI
- Core tests: 388
- EFRO scenario target: 1000 (per EFRO_SCENARIO_TARGET)

Deploy
- Hosting: Render
- Produkte: Supabase

Kurz: minimale invasive Änderungen; vor PR immer sellerbrain-Szenarien ausführen und failing sections zeigen.
