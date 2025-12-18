# EFRO System Map

"Wenn ein Problem auftaucht: Erst zuordnen zu (Daten / Brain / UI / Ops). Alles andere kommt als Ticket in ‘Baustellen’."

This document maps components, entry points and data flows that are visible in the current working set. Each fact is backed by a file path and a short code excerpt. If something is not present in the working set it is marked UNBEKANNT and I list the exact search I performed.

---

## 1) Deploy / Ops

- Render manifest
  - Status: UNBEKANNT
  - What I searched: repository root for `render.yaml`, `render.yml`, `Dockerfile`, `Procfile`, README references to render.
  - Reason: no render manifest file was found in working set.

- package.json scripts (evidence of commands)
  - File: c:\efro_fast\efro_work_fixed\package.json
  - Evidence (added scripts earlier — excerpt from earlier changes):
    "sellerbrain:scenarios:core": "tsx scripts/test-sellerBrain-scenarios.ts",
    "sellerbrain:scenarios:curated": "tsx scripts/test-sellerBrain-scenarios-curated.ts"
  - Note: full package.json not printed here; presence of those script names was added in the working set.

- Base URLs / local dev
  - Local: tests and scripts call the local API URL:
    - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
    - Excerpt:
      const DEBUG_PRODUCTS_URL = process.env.EFRO_DEBUG_PRODUCTS_URL ?? "http://localhost:3000/api/efro/debug-products?shop=local-dev";
  - Production: UNBEKANNT (no render manifest found to show production URL)

- Env vars referenced in repo (Ops-relevant)
  - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
    Excerpt:
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  - File: c:\efro_fast\efro_work_fixed\scripts\lib\loadDebugProducts.ts
    Excerpt (allow fallback default):
      const allowFixtureFallback = opts.allowFixtureFallback ?? (process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1");
  - Other env mentions in working set: EFRO_SCENARIO_TARGET, EFRO_DEBUG_PRODUCTS_URL, EFRO_ALLOW_FIXTURE_FALLBACK (see scripts files).

- How to debug Prod without downtime
  - Based only on files in working set: use the dataset=scenarios fixture endpoint for reproducible data:
    - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
    - Excerpt:
      if (dataset === "scenarios") { return NextResponse.json({ products: debugProductsScenarios, source: "fixture" }); }
  - No evidence of blue/green deploy, feature flags, or traffic shadowing in working set → UNBEKANNT for advanced zero-downtime debug mechanisms.

---

## 2) Datenfluss Produkte (diagram)

Flow (based only on present files):

scripts/fixtures/products.local.json (fixture)
  ↘ used by scripts/lib/loadDebugProducts.ts when API fetch fails or fixture mode
src/data/debugProducts.scenarios.ts (re-exports fixture)
  ↘ imported by
src/app/api/efro/debug-products/route.ts
  - ?dataset=scenarios → returns fixture (source: "fixture")
  - ?shop=... → queries Supabase (source: "supabase") (see evidence below)
  ↘ client code (test runners) hit:
    scripts/test-sellerBrain-scenarios.ts → loads products via DEBUG_PRODUCTS_URL (defaults to /api/efro/debug-products?shop=local-dev)

Concrete evidence (file + excerpt):

- loadDebugProducts usage & fallback:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpt:
    const { products, source } = await loadDebugProducts<EfroProduct[]>({
      url: DEBUG_PRODUCTS_URL,
      fixturePath: "scripts/fixtures/products.local.json",
      timeoutMs: 4000,
      allowFixtureFallback,
    });

- debug-products API implementation:
  - File: c:\efro_fast\efro_work_fixed\src\app\api\efro\debug-products\route.ts
  - Excerpts:
    // dataset=scenarios -> stable fixture
    return NextResponse.json({ products: debugProductsScenarios, source: "fixture" });
    ...
    const { data, error } = await supabase.from("products").select("*").eq("shop", shop);

- Fixture re-export:
  - File: c:\efro_fast\efro_work_fixed\src\data\debugProducts.scenarios.ts
  - Excerpt:
    import productsLocal from "../../../scripts/fixtures/products.local.json";
    export const debugProductsScenarios = products;

Routes referenced but NOT found in working set:

- /api/shopify-products
  - Status: UNBEKANNT (search for "shopify-products" under src/app/api returned no matching file in the working set)
  - I searched: all files in src/app/api and root for the string `shopify-products` and found no route file to document.

- /api/explain-product
  - Status: UNBEKANNT (search for "explain-product" under src/app/api returned no matching file in the working set)
  - I searched: the working set for `explain-product` and found no route implementation.

- /api/efro/products
  - Status: UNBEKANNT (search for `efro/products` path — no file found in working set)

Fallbacks / Data sources:
- Fixture fallback: scripts/fixtures/products.local.json (used when API fetch fails and allowFixtureFallback true).
  - Evidence: scripts/test-sellerBrain-scenarios.ts and scripts/lib/loadDebugProducts.ts.
- Supabase live fetch:
  - Evidence: src/app/api/efro/debug-products/route.ts uses createClient and `.from("products").select("*").eq("shop", shop)`.

---

## 3) Brain (SellerBrain)

What is visible in working set:

- Runners call runSellerBrain:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts
  - Excerpt (call):
    const result: SellerBrainResult = await runSellerBrain(
      test.query,
      initialIntent,
      products,
      plan,
      previousRecommended,
      sellerContext
    );

- Curated runner uses same function:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios-curated.ts
  - Excerpt: also calls runSellerBrain with same signature.

What is UNBEKANNT:
- The implementation file src/lib/sales/sellerBrain.ts is not present in the working set (search for `export function runSellerBrain` / filename returned no result).
  - I searched for: `runSellerBrain`, `sellerBrain`, `createRecommendations`, `handleUserTextInput`, `orchestrator` across `src/` and scripts; only imports were found in runner scripts but no implementation in working set.
- Because the implementation is missing, the following details are UNBEKANNT unless sellerBrain.ts is provided:
  - Exact orchestration steps (intent detection, budget parsing, ranking, filter order).
  - Where limits such as "cheapest snowboard cap <=700" are enforced.
  - Concrete SellerBrainResult shape (beyond what tests reference).

Visible modules touched by tests and edits:
- src/lib/sales/modules/filter/index.ts — we made edits here (budget-filter related).
  - Excerpt:
    let nearestPriceBelowBudget: number | null = null;
    let nearestProductTitleBelowBudget: string | null = null;
  - This shows budget filter logic exists in working set.

---

## 4) UI

What is visible:
- There's no explicit avatar-seller page in working set files provided to me, except that .github/copilot-instructions.md references `src/app/page.tsx` and `src/app/embed/`.
- The working set contains test scripts and API routes but not the Next.js pages that render the Mascot and chat UI.
  - I searched for `MascotClient`, `MascotRive`, `avatar-seller` across src/ and found no usage in the working set.

Debug parameters used by clients/runners:
- `shop` query param used by /api/efro/debug-products (evidence: debug-products route).
- `dataset=scenarios` used to request the scenarios fixture (evidence: debug-products route).
- Environment flags:
  - EFRO_ALLOW_FIXTURE_FALLBACK
  - EFRO_DEBUG_PRODUCTS_URL
  - EFRO_SCENARIO_TARGET

---

## 5) Observability / Logs / Monitoring

What exists in working set:
- console logging in scripts:
  - File: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts (many console.log lines for test progress)
- Conditional debug logging in filter module:
  - File: c:\efro_fast\efro_work_fixed\src\lib\sales\modules\filter\index.ts
  - Excerpt:
    if (context?.debug) { context.debug("budget-filter", "selected ...", {...}) }

What is UNBEKANNT or missing:
- No evidence in working set of Sentry / Datadog / PostHog / telemetry SDKs.
  - I searched for: `sentry`, `datadog`, `posthog`, `telemetry`, `captureException`, `logEvent`, `analytics` — no matches in working set -> therefore UNBEKANNT / not present.
- No centralized logging pipeline described in repo files present.

---

## Open Questions / Missing Info (only items not found in working set)
- /api/shopify-products implementation — UNBEKANNT (searched for `shopify-products` under `src/app/api`).
- /api/explain-product implementation — UNBEKANNT (searched for `explain-product` under `src/app/api`).
- SellerBrain implementation src/lib/sales/sellerBrain.ts — UNBEKANNT (search for file and exports).
- Main UI pages that render Mascot (e.g., src/app/page.tsx, src/app/avatar-seller/page.tsx) — UNBEKANNT (searched for `MascotClient`, `MascotRive`).
- Render manifest / deployment config (render.yaml) — UNBEKANNT (searched repo root).

