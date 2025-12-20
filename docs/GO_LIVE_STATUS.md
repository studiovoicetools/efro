### Snapshot (aktuell)
- Date: 2025-12-20
- Command: pnpm sellerbrain:scenarios:curated
- Result: 892/1000 PASS (108 FAIL)
- Log: logs\curated-1000-<DEIN_TIMESTAMP>.log
- Note: EFRO_SCENARIO_TARGET darf für curated NICHT gesetzt sein (sonst Abbruch).
 
 
 
 
 
 
 
 # GO LIVE STATUS (Source of Truth)

Last updated: 2025-12-19 18:49

Rule: Facts only. Every claim needs evidence (URL + statuscode or command output).

## A) Reality Snapshot (Evidence)

### Data (Supabase / Products)
- [ ] /api/efro/debug-products?dataset=scenarios  => (status: __) (source: __)
- [ ] /api/efro/debug-products?shop=local-dev     => (status: __) (source: __)

### Voice (MascotBot + ElevenLabs)
- [ ] Avatar speaks + mouth movement => Evidence: (page/url + note)
- [ ] /api/get-signed-url observed in Network => (yes/no) Evidence: __

### UI (Landing / Widget / Avatar Seller)
- [ ] /avatar-seller?shop=demo&debug=1 => (status: __) Evidence: __
- [ ] Widget bottom-right, no overlap => (ok/not ok) Evidence: __

### Brain (SellerBrain / Scenarios)
- [ ] pnpm sellerbrain:scenarios => (__/__ pass) Evidence: __
- [ ] pnpm sellerbrain:scenarios:curated => (pass/fail) Evidence: __

### Ops (Render / Env / Logs)
- [ ] Render URL reachable => Evidence: __
- [ ] Render: /api/efro/debug-products?dataset=scenarios => (status: __) Evidence: __

## B) Go/No-Go Gates
- Gate 1 (Demo UI reachable): [ ] GO / [ ] NO-GO
- Gate 2 (Products reachable: fixture + supabase): [ ] GO / [ ] NO-GO
- Gate 3 (Scenarios stable): [ ] GO / [ ] NO-GO
- Gate 4 (Deploy parity): [ ] GO / [ ] NO-GO
- Gate 5 (Minimal logs): [ ] GO / [ ] NO-GO

## C) Next 3 actions (max)
1)
2)
3)

## D) Change Log
- 2025-12-19: created initial status doc
### Auto Snapshot 2025-12-19 18:49
- Fixture: http://localhost:3000/api/efro/debug-products?dataset=scenarios => status 200 source 'debug-products'
- Live:    http://localhost:3000/api/efro/debug-products?shop=local-dev => status 200 source 'debug-products'

### Supabase usage (evidence)
- Supabase is used for Shopify -> Supabase sync via webhook:
  - src/app/api/shopify-webhook/route.ts upserts into table 'products' (onConflict: sku)
- Conclusion: Shopify is source of truth; Supabase is cache/storage for products.
- Supabase read check: GET /api/supabase-products?shop=local-dev => 500 (needs env/schema/auth fix)
### Supabase read (fixed)
- GET /api/supabase-products?shop=local-dev => success=true count=49 (2025-12-19)
- Root cause: env var mismatch. Route expects NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY.
- Fix applied: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local (server-side only).
### Brain status (verified)
- pnpm sellerbrain:scenarios => 388/388 PASS (2025-12-19)
- pnpm sellerbrain:scenarios:curated => 892/1000 PASS (108 FAIL) (2025-12-19)
- Next: cluster the 108 fails (top 3 root causes) and create tickets.





GO LIVE STATUS (Stand: 2025-12-21)
Grün (funktioniert)

Render Build + Deploy: ✅ grün

Health Endpoint: ✅

Supabase Products Endpoint: ✅ (49 Produkte)

EFRO Products Endpoint: ✅ (source: products_demo)

Shopify Products Endpoint: ✅ (source: shopify-admin)

Local Setup: ✅ läuft wieder stabil (pnpm dev)

Gelb (funktioniert, aber nicht „Profi-Level“)

ESLint Warnings (Hooks deps / img statt next/image) → aktuell nicht blockierend

Produktkarten/Recommendation-UX: läuft, aber Feinschliff nötig (Profi-Seller Feeling)

Logs/Operator-Sicht: vorhanden, aber muss „Go-Live-ready“ strukturiert werden

Rot (Go-Live Blocker / echte Baustellen)

Shopify Embed

EFRO muss sauber in Shopify Demo-Storefront eingebettet werden (Script/Widget).

Ziel: EFRO unten rechts, darf keine Landing-Blocks überlappen.

Onboarding + Lipsync

Lipsync im Onboarding ist noch nicht zuverlässig im gleichen Flow wie „Mascot Conversation“ integriert.

Ticket: Onboarding auf den stabilen Conversation-Flow umstellen, damit Lipsync auch dort funktioniert.

Event Logs / Telemetrie

Ziel: nachvollziehbare Events (Session start, intent detected, recommendation served, CTA clicked, error).

Operator-Ansicht für Pro/Enterprise (später).

Definition of Done (Go-Live minimal)

Render deployt main stabil

Shopify Embed in Demo-Store sichtbar + klickbar

EFRO kann auf Demo-Store Produkte empfehlen (shop param)

Keine „ENV fehlt“ Crashes mehr im Build (build-safe routes)

Minimaler Monitoring/Runbook-Workflow dokumentiert (Render Ops)

Definition of Done (Profi-Seller)

Kategorie/Budget/Intent stabil in vielen realen Queries (Suite erweitern)

KB / Store-Policies (Versand/Retoure/FAQ) anbindbar

Caching (AI/TTS) aktiv, um Kosten zu senken

Onboarding + Voice wirken „premium“
'@ | Set-Content -Encoding UTF8 .\docs\GO_LIVE_STATUS.md

@'