# OPS Runbook — EFRO

## Quick checks & smoke tests

1) Verify debug-products fixture endpoint (stable scenario set)
   - URL: GET /api/efro/debug-products?dataset=scenarios
   - File: src/app/api/efro/debug-products/route.ts
   - Evidence (excerpt):
     return NextResponse.json({ products: debugProductsScenarios, source: "fixture" });

2) Verify local debug API (shop)
   - URL example: GET /api/efro/debug-products?shop=local-dev
   - Behavior: If `shop` missing or no products in Supabase for shop -> 404 (explicit decision)
   - Evidence excerpt:
     if (!shop) { return NextResponse.json({ error: "Shop parameter missing or invalid" }, { status: 404 }) }
     if (!data || data.length === 0) { return NextResponse.json({ error: "Shop not found or no products for shop" }, { status: 404 }) }

3) Run core scenarios (local)
   - pnpm sellerbrain:scenarios
   - Runner file: scripts/test-sellerBrain-scenarios.ts

4) Run curated scenarios (strict)
   - pnpm sellerbrain:scenarios:curated
   - Runner file: scripts/test-sellerBrain-scenarios-curated.ts
   - Note: curated runner FAILS if EFRO_SCENARIO_TARGET > 0 or expanded total != 1000.

## Logging & Monitoring (current state)
- Found console logging in scripts and modules (used by tests and local dev):
  - scripts/test-sellerBrain-scenarios.ts — heavy console.log for scenario runs.
  - scripts/test-sellerBrain-scenarios-curated.ts — logs expansion counts and results.
  - src/lib/sales/modules/filter/index.ts — context.debug used conditionally; example:
    if (context?.debug) { context.debug("budget-filter", "selected ...", {...}) }
- Centralized telemetry (Sentry/Datadog/Posthog) — UNBEKANNT / not found.
  - Search terms used: "sentry", "datadog", "posthog", "telemetry", "captureException", "logEvent", "analytics"
  - Result: no matches in working set.

## Failures & Troubleshooting
- If tests fail due to missing products:
  1) Check GET /api/efro/debug-products?dataset=scenarios — should return fixture.
  2) Check env EFRO_ALLOW_FIXTURE_FALLBACK (scripts/lib/loadDebugProducts.ts default is process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1").
  3) If using live shop, verify SUPABASE_URL and SUPABASE_ANON_KEY env vars.
  4) If supabase returns empty for shop, endpoint intentionally returns 404 to surface data/config error (see debug-products route).

## Baustellen (to be opened as tickets)
- Provide /api/shopify-products implementation and document its response shape.
- Provide /api/explain-product implementation and document expected inputs/outputs.
- Provide SellerBrain implementation file(s) to extract the module-level architecture and where pricing/sales policy rules are enforced.
- Add centralized telemetry & error tracking (Sentry/Datadog) and wire up to critical routes and SellerBrain errors.

