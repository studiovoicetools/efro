# EFRO – Render Ops

Last updated: 2025-12-20  
Commit: c3cc7c2dc2aaddeec3322f9eac6d265b669d3b70  
Branch: feature/curated1000  
Maintainer: Derin

## Deploy Pipeline
TODO: build/start commands, node version, healthcheck

## Env Vars (nur Namen)
TODO

## Logs / Debug / Rollback
TODO




RENDER OPS (Stand: 2025-12-21)
Deployment-Grundsatz

Render deployt den Branch, der im Service konfiguriert ist.
Aktuell: main.

Wenn Fixes in einem Feature-Branch landen (z.B. feature/curated1000), dann:

entweder Render auf diesen Branch umstellen

oder (besser) sauber nach main mergen und main pushen

Standard-Checks nach jedem Deploy
$BASE="https://efro-prod.onrender.com"
irm "$BASE/api/health"
irm "$BASE/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count

Wenn Render „ENV fehlt“ meldet

Render ENV prüfen:

SUPABASE_URL

SUPABASE_SERVICE_KEY

NEXT_PUBLIC_SUPABASE_URL

Redeploy/Restart

Prüfen ob Code build-safe ist:

Kein createClient() auf Module-Top-Level bei API Routen, die ENV brauchen.
'@ | Set-Content -Encoding UTF8 .\docs\RENDER_OPS.md

@'