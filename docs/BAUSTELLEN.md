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

T1 — /api/shopify-products (present)
- Symptom: route exists and proxies Shopify Admin API.
- Kategorie: Data
- Dateien: `src/app/api/shopify-products/route.ts`
- Evidence: file contains `export async function GET()` and env checks for `SHOPIFY_STORE_DOMAIN` / `SHOPIFY_ADMIN_ACCESS_TOKEN`.
- Note: Response is the raw Shopify Admin API JSON plus `source: "shopify-admin"` — consumers should use `GET /api/efro/products?shop=...` for normalized EfroProduct output.
- Risk/Impact: high (frontend & tests rely on product API)

T2 — /api/explain-product (present)
- Symptom: route implemented as an OpenAI-backed product explainer.
- Kategorie: Data
- Dateien: `src/app/api/explain-product/route.ts`
- Evidence: file exposes `export async function POST(req: Request)` and expects `{ handle, question }` in body; calls `/api/shopify-products?handle=...` and OpenAI.
- Note: Returns `{ ok: true, answer }` on success; 400/404/502/500 on error cases.
- Risk/Impact: medium

T3 — Supabase `products` schema unknown (ACTION REQUIRED)
- Symptom: `src/app/api/efro/debug-products/route.ts` queries Supabase `.from("products")` but the repository's expected column set is not documented in repo migrations.
- Kategorie: Data
- Dateien: `src/app/api/efro/debug-products/route.ts`, `src/lib/efro/efroSupabaseRepository.ts` (repo accessors)
- Root cause hypothesis: migrations or SQL schema files not checked into repo (or located externally in infra repo).
- Next Actions:
  1. Add SQL migration (e.g., `migrations/xxxx_create_products_table.sql`) documenting required columns: id, title, handle, price, category, available, shop.
  2. Add a short `docs/PRODUCTS_SCHEMA.md` listing fields and example row.
  3. Update `docs/OPS_RUNBOOK.md` with expected Supabase envs and a sample query.
- Definition of Done (DoD): a committed migration file + `docs/PRODUCTS_SCHEMA.md` with example, and `GET /api/efro/products?shop=demo` returns `source: "shopify"|"mock"` with expected product fields in CI smoke test.
- Risk/Impact: high

---

## Brain

T4 — SellerBrain implementation (present)
- Symptom: implementation exists at `src/lib/sales/sellerBrain.ts` and orchestration in `src/lib/sales/brain/orchestrator.ts`.
- Kategorie: Brain
- Dateien: `src/lib/sales/sellerBrain.ts`, `src/lib/sales/brain/orchestrator.ts`
- Evidence: `runSellerBrain()` exports and `runOrchestrator()` implementation present. Orchestrator documents SellerBrainResult shape and filter pipeline.
- Note: internal module breakdown is in `brain/orchestrator.ts` (large file). Please review if further decomposition needed.
- Risk/Impact: high

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

---

## Top-5 Ticket Templates (precise)

T-A: Supabase `products` schema (Data)
- Symptom: API queries `.from("products")` but no migration/schema in repo.
- Root cause hypothesis: schema maintained externally (infra) or missing migration.
- Files & anchors: `src/app/api/efro/debug-products/route.ts` (uses Supabase), `src/lib/efro/efroSupabaseRepository.ts`
- Next actions:
  1. Add SQL migration `migrations/0001_create_products_table.sql` with required columns.
  2. Add `docs/PRODUCTS_SCHEMA.md` with example row and mapping to `EfroProduct` fields.
  3. Add CI smoke test that calls `GET /api/efro/products?shop=demo` and validates fields.
- Definition of Done: migration and docs committed; CI smoke test passes on branch.
- Risk & Rollback: schema migration is additive; rollback by reverting migration commit.

T-B: Centralized telemetry (Ops)
- Symptom: No Sentry/Posthog/Datadog instrumentation found.
- Root cause hypothesis: telemetry intentionally not integrated yet.
- Files & anchors: candidate integration points: `src/app/api/efro/debug-products/route.ts`, `src/lib/sales/brain/orchestrator.ts`
- Next actions:
  1. Decide provider (Sentry recommended for errors) and add DSN to envs.
  2. Add minimal init (server-side) and wrap critical endpoints with error capture.
  3. Add an alerting policy doc in `docs/OPS_RUNBOOK.md`.
- Definition of Done: errors captured in chosen provider from production; basic alerts configured.
- Risk & Rollback: config-only change; rollback by removing SDK initialization.

T-C: Product API contract harmonization (Data)
- Symptom: `/api/shopify-products` returns raw Shopify admin JSON, while consumers expect normalized `EfroProduct` shape via `/api/efro/products`.
- Root cause hypothesis: historical dual endpoints; inconsistency leads to fragile consumers.
- Files & anchors: `src/app/api/shopify-products/route.ts`, `src/app/api/efro/products/route.ts`, `src/lib/products/efroProductLoader.ts`
- Next actions:
  1. Decide authoritative endpoint for app (recommend `GET /api/efro/products?shop=` with normalized shape).
  2. Add docs in README and `docs/EFRO_SYSTEM_MAP.md` showing expected shapes.
  3. Optionally change `shopify-products` to return normalized shape or add adapter endpoint.
- Definition of Done: consumers use `/api/efro/products`; smoke tests validate normalized fields.
- Risk & Rollback: API contract change may break external integrators; release with compatibility adapter.

T-D: Endpoint smoke-tests & CI (Ops/QA)
- Symptom: No automated smoke tests validating key endpoints in CI.
- Root cause hypothesis: tests exist locally (scripts) but not executed in CI pipeline.
- Files & anchors: scripts/test-sellerBrain-scenarios.ts, scripts/test-sellerBrain-scenarios-curated.ts
- Next actions:
  1. Add GitHub Actions or CI job to run `pnpm sellerbrain:scenarios` and a small bash smoke test set (`curl` calls to `/api/efro/debug-products` and `/api/efro/products`).
  2. Fail the job on non-200 or missing fields.
- Definition of Done: CI pipeline runs smoke-tests on PRs to `main` and feature branches.
- Risk & Rollback: CI flakiness — mitigate with retries and timeouts.

T-E: Render deployment env mapping (Ops)
- Symptom: `render.yaml` exists but repo lacks mapping doc tying code env vars to Render env vars.
- Root cause hypothesis: envs configured ad-hoc in Render dashboard.
- Files & anchors: `render.yaml`, `.env.example`, `docs/ENVIRONMENT.md`
- Next actions:
  1. Add `docs/RENDER_ENV_MAPPING.md` listing required Render env keys and sample values.
  2. Ensure `render.yaml` branch and service name documented in README.
- Definition of Done: `docs/RENDER_ENV_MAPPING.md` committed and ops person can reproduce deploy with documented envs.
- Risk & Rollback: misconfiguring env values may break runtime; document rollback and reminder to not commit secrets.

