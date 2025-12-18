Deployment (Render)
- Build: Produktionsbuild von branch main
- Env: Render-Projektvariablen (keine .env commits)

Lokal
- pnpm install
- pnpm dev
- pnpm sellerbrain:scenarios

Datenquellen
- Produktdaten: Supabase
- Wichtige API-Endpunkte: src/app/api/*

Monitoring
- CI muss Szenarien ausgeben; bei Problemen Render-Logs prüfen.
