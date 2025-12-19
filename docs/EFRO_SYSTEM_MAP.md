# EFRO System Map

"Wenn ein Problem auftaucht: Erst zuordnen zu (Daten / Brain / UI / Ops). Alles andere kommt als Ticket in ‘Baustellen’."

Hinweis: Alle Aussagen basieren ausschließlich auf Dateien im aktuellen Working Set. Jede Aussage enthält mindestens eine Dateiquelle + kurzen Codeauszug als Beleg. Wo etwas nicht gefunden wurde steht "UNBEKANNT" plus genaue Suchbegriffe.

---

Mini-TOC

- [Overview](#1-deploy--ops)
- [Data Flow](#2-datenfluss-produkte-diagram-evidence-backed)
- [Brain](#3-brain-sellerbrain)
- [UI](#4-ui)
- [Observability](#5-observability--logs--monitoring)
- Related docs: [ARCH: SellerBrain](ARCH_SELLERBRAIN.md), [ARCH: MascotBot](ARCH_MASCOTBOT.md), [OPS Runbook](OPS_RUNBOOK.md), [Baustellen](BAUSTELLEN.md), [Environment](ENVIRONMENT.md), [Go-Live Checklist](CHECKLIST_GO_LIVE.md)

## 1) Deploy / Ops

- Render / deploy manifest
  - Status: gefunden
  - File: c:\efro_fast\efro_work_fixed\render.yaml
  - Note: `render.yaml` exists in repo root and defines a service `efro-prod` (see render.yaml). Other deployment-specific env vars are expected to be configured in the Render service settings.

- package.json scripts (evidence of test/run commands)
  - File: c:\efro_fast\efro_work_fixed\package.json
  - Excerpt (scripts added in working set):
    "sellerbrain:scenarios:core": "tsx scripts/test-sellerBrain-scenarios.ts",
    "sellerbrain:scenarios:curated": "tsx scripts/test-sellerBrain-scenarios-curated.ts"
  - Note: These scripts are used to run scenario runners locally.

- Local base URL used by tests
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpt:
    const DEBUG_PRODUCTS_URL =
      process.env.EFRO_DEBUG_PRODUCTS_URL ??
      "http://localhost:3000/api/efro/debug-products?shop=local-dev";

- Env vars referenced (Ops-relevant)
  - SUPABASE_URL / SUPABASE_ANON_KEY
    - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
    - Excerpt:
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  - EFRO_ALLOW_FIXTURE_FALLBACK
    - File: c:\efro_fast\efro_work_fixed\scripts\lib\loadDebugProducts.ts
    - Excerpt:
      const allowFixtureFallback = opts.allowFixtureFallback ?? (process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1");
  - EFRO_SCENARIO_TARGET (runner)
    - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios-curated.ts
    - Excerpt:
      if (process.env.EFRO_SCENARIO_TARGET && Number(process.env.EFRO_SCENARIO_TARGET) > 0) { fail(...) }

- How to debug Prod without downtime (based on working set)
  - Use dataset fixture endpoint to reproduce tests with stable data:
    - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
    - Excerpt:
      if (dataset === "scenarios") {
        return NextResponse.json({ products: debugProductsScenarios, source: "fixture" });
      }
  - Advanced zero-downtime methods (traffic shadowing, blue/green) — UNBEKANNT (no evidence in working set).

---

## 2) Datenfluss Produkte (Diagram, evidence-backed)

Flow (files show arrows / calls):

scripts/fixtures/products.local.json (fixture)
  ↘ (used by) scripts/lib/loadDebugProducts.ts (fallback)
    - File: c:\efro_fast\efro_work_fixed\scripts\lib\loadDebugProducts.ts
    - Excerpt:
      return { products, source: "fixture" };

src/data/debugProducts.scenarios.ts (re-exports fixture)
  ↘ imported by
src/app/api/efro/debug-products/route.ts
  - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
  - Excerpts:
    import { debugProductsScenarios } from "../../../../src/data/debugProducts.scenarios";
    if (dataset === "scenarios") { return NextResponse.json({ products: debugProductsScenarios, source: "fixture" }); }
    const { data, error } = await supabase.from("products").select("*").eq("shop", shop);

scripts/test-sellerBrain-scenarios.ts (consumer)
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpts:
    const DEBUG_PRODUCTS_URL = process.env.EFRO_DEBUG_PRODUCTS_URL ?? "http://localhost:3000/api/efro/debug-products?shop=local-dev";
    const { products, source } = await loadDebugProducts<EfroProduct[]>({ url: DEBUG_PRODUCTS_URL, fixturePath: "scripts/fixtures/products.local.json", timeoutMs: 4000 });

Routes present / absent in working set:
- /api/efro/debug-products
  - Implemented: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts (see excerpts above).
  - Supports `?dataset=scenarios` (fixture) and `?shop=` (Supabase).
- /api/shopify-products
  - Status: UNBEKANNT (search for `shopify-products` under src/app/api returned no matching file in working set).
  - Searched for: filename `src/app/api/shopify-products/route.ts` and string `shopify-products`.
- /api/explain-product
  - Status: UNBEKANNT (search for `explain-product` under src/app/api returned no matching file in working set).
  - Searched for: filename `src/app/api/explain-product/route.ts` and string `explain-product`.

Supabase usage (live):
- File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
- Excerpt:
  const { data, error } = await supabase.from("products").select("*").eq("shop", shop);
- Note: exact `products` table schema (columns) is not present in working set → UNBEKANNT (provide DB schema).

Fallback policy:
- loadDebugProducts supports fixture fallback controlled by EFRO_ALLOW_FIXTURE_FALLBACK.
  - File: c:\efro_fast\efro_work_fixed\scripts\lib\loadDebugProducts.ts
  - Excerpt shows default of environment var.

---

## 3) Brain (SellerBrain)

Evidence of callers:
- Runners call runSellerBrain:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpt:
    const result: SellerBrainResult = await runSellerBrain(test.query, initialIntent, products, plan, previousRecommended, sellerContext);

- Curated runner similarly calls runSellerBrain:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios-curated.ts
  - Excerpts: same call signature.

What is missing:
- Implementation file `src/lib/sales/sellerBrain.ts` is UNBEKANNT in the working set (search for `runSellerBrain` shows only imports in runners).
  - Searched for: `runSellerBrain` symbol and `sellerBrain.ts` file under src/lib.

Modules we can point to (present in working set):
- Budget filter modifications exist:
  - File: c:\efro_fast\efro_work_fixed\src\lib\sales\modules\filter\index.ts
  - Excerpt:
    let nearestPriceBelowBudget: number | null = null;
    let nearestProductTitleBelowBudget: string | null = null;
- Tests expect SellerBrainResult fields:
  - priceRangeInfo, priceRangeNoMatch, intent, aiTrigger, recommended, sales
  - Evidence: many `evaluation` checks in scripts/test-sellerBrain-scenarios.ts (see function evaluateScenario).

Conclusions:
- Entry point (callers) are present; actual orchestrator code is missing from working set → UNBEKANNT where exact orchestration lives.

---

## 4) UI

- Evidence of UI files rendering mascot / avatar — UNBEKANNT in working set.
  - Search performed: `MascotClient`, `MascotRive`, `avatar-seller`, `avatar` in src/app; no page.tsx or avatar-seller page found in working set.

- Debug query params used by API (documented):
  - `?dataset=scenarios` (debug fixture) — File: src/app/api/efro/debug-products/route.ts
  - `?shop=` used by debug-products endpoint — File: src/app/api/efro/debug-products/route.ts

---

## 5) Observability / Logs / Monitoring

- Console logging
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpt: many `console.log` calls showing scenario progress.
- Conditional debug
  - File: c:\efro_fast\efro_work_fixed\src\lib\sales\modules\filter\index.ts
  - Excerpt:
    if (context?.debug) { context.debug("budget-filter", "selected ...", {...}) }

- Central telemetry (Sentry/Datadog/Posthog): UNBEKANNT
  - Searched for: `sentry`, `datadog`, `posthog`, `telemetry`, `captureException`, `logEvent` — no matches in working set.

---

## Open Questions (must be provided to continue)

- Provide `src/lib/sales/sellerBrain.ts` implementation (currently UNBEKANNT).
- Provide `src/app/api/shopify-products/route.ts` and `src/app/api/explain-product/route.ts` if they exist (currently UNBEKANNT).
- Provide UI page(s) (e.g., `src/app/page.tsx`, `src/app/avatar-seller/page.tsx`) that render Mascot (UNBEKANNT).
- Provide render deployment manifest (render.yaml) if exists (UNBEKANNT).

