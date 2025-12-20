# ENVIRONMENT (Stand: 2025-12-21)

## Lokal (Windows)
Datei: `C:\efro_fast\efro_work_fixed\.env.local` (Repo-Root)

Diese Datei wird **nicht** committed (sollte gitignored sein).

### Minimal (muss gesetzt sein)
SUPABASE_URL
SUPABASE_SERVICE_KEY

### Fallbacks (empfohlen, weil einzelne Routen NEXT_PUBLIC_* lesen)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

## Render (Production)
In Render im Service unter „Environment“ setzen:

### Muss
SUPABASE_URL
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL

### Optional
NEXT_PUBLIC_SUPABASE_ANON_KEY

## Typische Fehlerbilder
### "supabaseKey is required" / Build bricht ab
Ursache:
- createClient() wurde zu früh (Top-Level) gebaut ODER
- ENV im Build/Runtime Kontext fehlt

Fix:
- Client nur im Handler (GET/POST) erstellen
- Wenn ENV fehlt: saubere 500 JSON Response statt throw

### {"error":"supabaseUrl is required"}
Ursache:
- Route liest `NEXT_PUBLIC_SUPABASE_URL`, aber es ist nicht gesetzt

Fix:
- `NEXT_PUBLIC_SUPABASE_URL` in Render + lokal `.env.local` setzen








ENVIRONMENT (Stand: 2025-12-21)
Minimal (Render + Lokal)
Supabase

SUPABASE_URL

SUPABASE_SERVICE_KEY (Admin Key; bevorzugt)

NEXT_PUBLIC_SUPABASE_URL (Fallback in manchen Routen)

NEXT_PUBLIC_SUPABASE_ANON_KEY (optional fallback)

Wichtig:

SUPABASE_SERVICE_KEY ist der korrekte Name (nicht nur SERVICE_ROLE_KEY).

Manche Routen nutzen NEXT_PUBLIC_SUPABASE_URL als Fallback → auf Render ebenfalls setzen.

Typische Fehler & Bedeutung
Fehler: {"error":"supabaseUrl is required."}

Ursache: NEXT_PUBLIC_SUPABASE_URL fehlt (oder Code liest nur NEXT_PUBLIC_*).

Fix: in Render ENV NEXT_PUBLIC_SUPABASE_URL setzen + Redeploy.

Build Crash beim Deploy („Collecting page data…“ → supabaseKey is required)

Ursache: Supabase createClient() wurde auf Module-Top-Level erstellt und Next führt Code im Build-Kontext aus.

Fix: Client-Erstellung nur innerhalb von GET/POST; wenn ENV fehlt: saubere JSON 500 statt throw.
'@ | Set-Content -Encoding UTF8 .\docs\ENVIRONMENT.md

@'

@'
# --- Supabase (Server) ---
SUPABASE_URL=PASTE_HERE
SUPABASE_SERVICE_KEY=PASTE_HERE

# --- Supabase (optional Fallbacks, weil manche Routen NEXT_PUBLIC_* lesen) ---
NEXT_PUBLIC_SUPABASE_URL=PASTE_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_HERE
'@ | Set-Content -Encoding UTF8 .\.env.local



@'
# ENVIRONMENT (Stand: 2025-12-21)

## Lokal (Windows)
Datei: `C:\efro_fast\efro_work_fixed\.env.local` (Repo-Root)

Diese Datei wird **nicht** committed (sollte gitignored sein).

### Minimal (muss gesetzt sein)
SUPABASE_URL
SUPABASE_SERVICE_KEY

### Fallbacks (empfohlen, weil einzelne Routen NEXT_PUBLIC_* lesen)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

## Render (Production)
In Render im Service unter „Environment“ setzen:

### Muss
SUPABASE_URL
SUPABASE_SERVICE_KEY
NEXT_PUBLIC_SUPABASE_URL

### Optional
NEXT_PUBLIC_SUPABASE_ANON_KEY

## Typische Fehlerbilder
### "supabaseKey is required" / Build bricht ab
Ursache:
- createClient() wurde zu früh (Top-Level) gebaut ODER
- ENV im Build/Runtime Kontext fehlt

Fix:
- Client nur im Handler (GET/POST) erstellen
- Wenn ENV fehlt: saubere 500 JSON Response statt throw

### {"error":"supabaseUrl is required"}
Ursache:
- Route liest `NEXT_PUBLIC_SUPABASE_URL`, aber es ist nicht gesetzt

Fix:
- `NEXT_PUBLIC_SUPABASE_URL` in Render + lokal `.env.local` setzen
'@ | Set-Content -Encoding UTF8 .\docs\ENVIRONMENT.md



1) Lokal: Welche ENV-Namen, in welche Datei, und was genau tun
1.1 .env.local im Repo-Root erstellen/aktualisieren (lokal)

Datei: C:\efro_fast\efro_work_fixed\.env.local (liegt im Repo-Root, wird NICHT committed)

cd C:\efro_fast\efro_work_fixed

# falls du noch keine .env.local hast:
if (!(Test-Path .\.env.local)) {
  if (Test-Path .\.env.example) {
    Copy-Item .\.env.example .\.env.local -Force
  } else {
    New-Item -ItemType File -Path .\.env.local -Force | Out-Null
  }
}

# Datei im Editor öffnen (nimm eins davon)
code .\.env.local
# oder:
notepad .\.env.local


Inhalt (kurzfassung) – da rein (Values musst du aus Render/Supabase copy-pasten, ich kann sie nicht erfinden):

@'
# --- Supabase (Server) ---
SUPABASE_URL=PASTE_HERE
SUPABASE_SERVICE_KEY=PASTE_HERE

# --- Supabase (optional Fallbacks, weil manche Routen NEXT_PUBLIC_* lesen) ---
NEXT_PUBLIC_SUPABASE_URL=PASTE_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_HERE
'@ | Set-Content -Encoding UTF8 .\.env.local


Wichtig: SUPABASE_SERVICE_KEY ist der Name, den du bei EFRO verwendest (nicht nur SERVICE_ROLE_KEY).

1.2 Lokal prüfen, ob Next die ENV überhaupt sieht (ohne Secrets zu dumpen)
cd C:\efro_fast\efro_work_fixed

# zeigt nur die KEY-Namen (ohne Werte)
Get-Content .\.env.local | Where-Object { $_ -match "=" -and $_ -notmatch "^\s*#" } `
| ForEach-Object { ($_ -split "=",2)[0].Trim() } | Sort-Object -Unique


Erwartet mindestens:

SUPABASE_URL

SUPABASE_SERVICE_KEY

NEXT_PUBLIC_SUPABASE_URL (wenn deine Route es nutzt)

1.3 Lokal: Start + Smoke Tests (wie auf Render)

Terminal 1:

cd C:\efro_fast\efro_work_fixed
pnpm i
pnpm dev


Terminal 2:

irm "http://127.0.0.1:3000/api/health"
irm "http://127.0.0.1:3000/api/efro/products?shop=avatarsalespro-dev.myshopify.com" | select success,source
irm "http://127.0.0.1:3000/api/supabase-products?shop=avatarsalespro-dev.myshopify.com" | select success,count
irm "http://127.0.0.1:3000/api/shopify-products?shop=avatarsalespro-dev.myshopify.com" | select source

1.4 Lokal: Production Build Test (wichtig, weil Render genau das macht)
cd C:\efro_fast\efro_work_fixed
pnpm -s guard:mojibake
pnpm lint
pnpm build


Wenn das grün ist, bist du lokal Render-safe.