# Baustellen (Tickets)

Organized into four sections: Daten / Brain / UI / Ops. Each ticket includes Symptom, Dateien, Next Action.

---

## Daten

### T1: /api/shopify-products route missing / undocumented
- Symptom: Test code and docs reference `/api/shopify-products` but no route file exists in working set.
- Kategorie: Daten
- Betroffene Datei(en): UNBEKANNT (expected path `src/app/api/shopify-products/route.ts`), search performed for `shopify-products` under `src/app/api`.
- Next Action:
  - 1) Add `src/app/api/shopify-products/route.ts` to working set or provide existing file.
  - 2) Document query params and response schema (fields used by frontend/tests).
  - 3) Implement or wire to Supabase/Shopify as appropriate.

### T2: /api/explain-product route missing
- Symptom: `/api/explain-product` is listed in project docs but implementation missing.
- Kategorie: Daten
- Betroffene Datei(en): expected `src/app/api/explain-product/route.ts` (UNBEKANNT)
- Next Action:
  - 1) Provide route implementation or point to file.
  - 2) Ensure POST contract (handle, question) matches callers in codebase.
  - 3) Add tests for expected output shape.

### T3: Supabase products table schema unknown
- Symptom: API queries `.from("products").select("*").eq("shop", shop)` but exact schema (column names) not documented.
- Kategorie: Daten
- Betroffene Datei(en): src/app/api/efro/debug-products/route.ts
- Next Action:
  - 1) Provide DB schema or SQL migration for `products` table.
  - 2) Document fields used by SellerBrain (id, title, price, category, handle, available).

---

## Brain

### T4: SellerBrain implementation missing from working set
- Symptom: Runners import `runSellerBrain` but the implementation file is not present.
- Kategorie: Brain
- Betroffene Datei(en): expected `src/lib/sales/sellerBrain.ts` — UNBEKANNT
- Next Action:
  - 1) Add `src/lib/sales/sellerBrain.ts` into working set.
  - 2) Provide a short README describing modules: intent detection, price parsing, filters, ranking.
  - 3) Add unit tests for the budget/intent rules (S2v2, S4v2, S5v1, S5v6, F6v2).

### T5: Business rule enforcement unclear (cheapest snowboard cap, board ambiguity)
- Symptom: AGENTS.md prescribes rules (e.g., cheapest snowboard <= 700; "board" → ASK_CLARIFICATION) but enforcement points in code are not verifiable from working set.
- Kategorie: Brain
- Betroffene Datei(en): src/lib/sales/modules/filter/index.ts (partial), expected sellerBrain.ts (missing)
- Next Action:
  - 1) Provide sellerBrain.ts and point to where rules are enforced.
  - 2) Add unit tests asserting those rules.

---

## UI

### T6: Mascot / Avatar UI file(s) not found
- Symptom: project docs require MascotClient usage but no UI page implementing it is visible.
- Kategorie: UI
- Betroffene Datei(en): expected `src/app/page.tsx`, `src/app/avatar-seller/page.tsx` — UNBEKANNT
- Next Action:
  - 1) Provide the page file(s) that render the Mascot or add them to working set.
  - 2) Verify ElevenLabs integration flow (client calls `/api/get-signed-url`).

### T7: Debug parameters documentation missing for frontend
- Symptom: Debug endpoints (dataset, shop) exist but UI docs do not show how to use them.
- Kategorie: UI
- Betroffene Datei(en): scripts/test-sellerBrain-scenarios.ts (reference), src/app/api/efro/debug-products/route.ts
- Next Action:
  - 1) Add README section describing `?dataset=scenarios` and `?shop=...` usage for developers.

---

## Ops

### T8: Render deployment manifest missing
- Symptom: Repo mentions Render as host but render config not found.
- Kategorie: Ops
- Betroffene Datei(en): render.yaml (expected path) — UNBEKANNT
- Next Action:
  - 1) Provide `render.yaml` or equivalent manifest.
  - 2) Add required ENV names to README / docs/ENVIRONMENT.md.

### T9: Centralized logging/telemetry not present
- Symptom: No Sentry/Datadog/Posthog observed in working set.
- Kategorie: Ops
- Betroffene Datei(en): search for `sentry`/`posthog`/`datadog` returned no results
- Next Action:
  - 1) Decide on telemetry provider and add instrumentation to critical routes and SellerBrain.
  - 2) Add runbook entries for alerting.

### T10: Fixtures and fixture fallback policy unclear in prod
- Symptom: loadDebugProducts supports EFRO_ALLOW_FIXTURE_FALLBACK but policy and prod setting unknown.
- Kategorie: Ops
- Betroffene File(s): scripts/lib/loadDebugProducts.ts, scripts/test-sellerBrain-scenarios.ts
- Next Action:
  - 1) Decide whether fixture fallback allowed in CI/prod and set EFRO_ALLOW_FIXTURE_FALLBACK accordingly in deployment env.
  - 2) Document policy in docs/OPS_RUNBOOK.md.

---

## Notes about searches performed (for transparency)

I only searched the current working set. For each UNBEKANNT I attempted these searches inside the working set:
- filename searches for `src/app/api/shopify-products/route.ts`, `src/app/api/explain-product/route.ts`, `src/lib/sales/sellerBrain.ts`, `render.yaml`, `src/app/page.tsx`, `src/app/avatar-seller/page.tsx`.
- string searches for identifiers: `shopify-products`, `explain-product`, `runSellerBrain`, `MascotClient`, `ElevenLabs`, `sentry`, `datadog`, `posthog`.
- Where files existed I quoted small code excerpts as evidence above.

