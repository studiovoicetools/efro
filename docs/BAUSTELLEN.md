# Baustellen (Tickets)

Priorisiert: Data → Brain → UI → Ops

---

Mini-TOC

- [Data](#data)
- [Brain](#brain)
- [UI](#ui)
- [Ops](#ops)
- Related docs: [EFRO System Map](EFRO_SYSTEM_MAP.md), [OPS Runbook](OPS_RUNBOOK.md), [CHECKLIST Go Live](CHECKLIST_GO_LIVE.md)


## Data

T1 — /api/shopify-products missing
- Symptom: Code/docs reference `/api/shopify-products` but route file not present in working set.
- Kategorie: Daten
- Dateien: expected `src/app/api/shopify-products/route.ts` (UNBEKANNT)
- Next Action:
  1. Add or provide `src/app/api/shopify-products/route.ts`.
  2. Document query params and response schema (fields used by UI/tests).
  3. Wire to Supabase or Shopify as required.
- Risk/Impact: high (frontend & tests rely on product API)

T2 — /api/explain-product missing
- Symptom: Docs reference `/api/explain-product` but no implementation found.
- Kategorie: Daten
- Dateien: expected `src/app/api/explain-product/route.ts` (UNBEKANNT)
- Next Action:
  1. Provide the route implementation file.
  2. Ensure POST contract (body: { handle, question }) is implemented.
- Risk/Impact: medium (product explanation feature unavailable)

T3 — Supabase `products` schema unknown
- Symptom: debug-products queries `.from("products").select("*")` but column mapping used by SellerBrain unclear.
- Kategorie: Daten
- Dateien: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
- Next Action:
  1. Provide DB schema / SQL migration for `products` table.
  2. Document fields required by SellerBrain (id, title, handle, price, category, available).
- Risk/Impact: high (misaligned schema causes runtime errors)

---

## Brain

T4 — sellerBrain.ts implementation missing
- Symptom: Runners import `runSellerBrain` but the implementation file is not in working set.
- Kategorie: Brain
- Dateien: expected `src/lib/sales/sellerBrain.ts` (UNBEKANNT)
- Next Action:
  1. Add/provide `src/lib/sales/sellerBrain.ts`.
  2. Brief doc describing architecture and module entry points (intent detection, budget parsing, ranking).
- Risk/Impact: high (core logic missing)

T5 — Enforcement of business rules not verifiable
- Symptom: AGENTS.md requires rules (e.g., cheapest snowboard cap ≤700) but enforcement points are not present/visible.
- Kategorie: Brain
- Dateien: src/lib/sales/modules/filter/index.ts (partial), expected `src/lib/sales/sellerBrain.ts`
- Next Action:
  1. Provide sellerBrain implementation.
  2. Add unit tests for rules S2v2, S4v2, S5v1, S5v6, F6v2.
- Risk/Impact: high (wrong product recommendations)

---

## UI

T6 — Mascot UI pages missing
- Symptom: No page in working set renders Mascot using documented pattern.
- Kategorie: UI
- Files: expected `src/app/page.tsx` or `src/app/avatar-seller/page.tsx` (UNBEKANNT)
- Next Action:
  1. Add/provide UI page(s) that render MascotClient/MascotRive.
  2. Verify ElevenLabs signed URL flow (`/api/get-signed-url`) from client.
- Risk/Impact: medium (UX missing)

T7 — Debug usage docs
- Symptom: Developers need concise steps to use `?dataset=scenarios` and `shop=` params.
- Kategorie: UI
- Files: docs + readme
- Next Action:
  1. Add short README section showing example calls:
     - /api/efro/debug-products?dataset=scenarios
     - /api/efro/debug-products?shop=local-dev
- Risk/Impact: low

---

## Ops

T8 — Deployment manifest missing
- Symptom: Repo mentions Render but manifest `render.yaml` not in working set.
- Kategorie: Ops
- Files: expected `render.yaml` (UNBEKANNT)
- Next Action:
  1. Add `render.yaml` or document Render settings in README.
  2. List required ENV names and branch to deploy.
- Risk/Impact: medium

T9 — Centralized telemetry not present
- Symptom: No Sentry/Datadog/Posthog found in working set.
- Kategorie: Ops
- Files: (search: `sentry`, `posthog`, `datadog`) — none found.
- Next Action:
  1. Decide on telemetry provider.
  2. Instrument critical endpoints and SellerBrain errors.
- Risk/Impact: medium

T10 — Fixture fallback policy ambiguous
- Symptom: loadDebugProducts supports EFRO_ALLOW_FIXTURE_FALLBACK, but policy unknown.
- Kategorie: Ops
- Files: c:\efro_fast\efro_work_fixed\scripts\lib\loadDebugProducts.ts
- Next Action:
  1. Decide fallback policy (CI/prod) and set EFRO_ALLOW_FIXTURE_FALLBACK env accordingly.
  2. Document policy in OPS_RUNBOOK.
- Risk/Impact: medium

---

## Search log (what I looked for in working set)
- Searched for files/strings: `render.yaml`, `shopify-products`, `explain-product`, `runSellerBrain`, `sellerBrain`, `MascotClient`, `MascotRive`, `sentry`, `posthog`, `datadog`.
- Where not found I listed UNBEKANNT and exact search terms above.

