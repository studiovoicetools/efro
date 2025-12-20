# OPS Runbook — EFRO

## Quick checks & smoke tests

Mini-TOC

- [Quick checks & smoke tests](#quick-checks--smoke-tests)
- [Logging & Monitoring](#logging--monitoring-current-state)
- [Failures & Troubleshooting](#failures--troubleshooting)
- [Monitoring / Alerts](#monitoring--alerts-minimal-plan)
- Related docs: [Environment](ENVIRONMENT.md), [CHECKLIST Go Live](CHECKLIST_GO_LIVE.md), [Baustellen](BAUSTELLEN.md)

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
 - Centralized telemetry (Sentry/Datadog/Posthog) — NOT FOUND in codebase.
   - Search terms used: "sentry", "datadog", "posthog", "telemetry", "captureException", "logEvent", "analytics"
   - Result: no matches in working set. Action: create Ops ticket to add telemetry instrumentation.

### API Contracts (selected / extracted)

- `GET /api/efro/debug-products?dataset=scenarios`
  - File: src/app/api/efro/debug-products/route.ts
  - Query params: `dataset=scenarios` â†’ returns fixture JSON `{ products: [...], source: "fixture" }` (200)

- `GET /api/shopify-products`
  - File: src/app/api/shopify-products/route.ts
  - Method: GET
  - Response: proxies Shopify Admin API JSON, returns `{ source: "shopify-admin", ... }`.
  - Errors: 500 when `SHOPIFY_STORE_DOMAIN` or `SHOPIFY_ADMIN_ACCESS_TOKEN` missing.

- `GET /api/efro/products?shop=<domain>`
  - File: src/app/api/efro/products/route.ts
  - Query: `shop` optional. Behavior: uses Supabase repository if available, otherwise falls back to Shopify or mockCatalog.
  - Response shape: `{ success: boolean, source: "shopify"|"mock"|"none", products: EfroProduct[], shopDomain?: string, error?: string }`

- `POST /api/explain-product`
  - File: src/app/api/explain-product/route.ts
  - Body: `{ handle: string, question: string }`
  - Success: `200 { ok: true, answer: string }`
  - Errors: `400` (missing fields), `404` (no product), `502` (upstream failure), `500` (server error / missing OPENAI_API_KEY)

- `POST /api/get-signed-url` and `POST /api/get-signed-url-seller`
  - Files: src/app/api/get-signed-url/route.ts, src/app/api/get-signed-url-seller/route.ts
  - Body: `{ dynamicVariables?: Record<string,string> }`
  - Success: `200 { signedUrl: string }`
  - Errors: `500` if Mascot or ElevenLabs env vars missing or Mascot API returns error (details returned in body).

Refer to the source files under `src/app/api/**/route.ts` for full method implementations and additional endpoints.

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


---

## Encoding / Mojibake Guard (wichtig)
Problem:
- In API-Responses gab es Mojibake-Zeichen (z. B. <MOJIBAKE_BYTES>, <CTRL_CHARS>).

Fix/Mechanik:
- Zentrale Text-Reparatur: src/lib/text/encoding.ts (deep-fix für alle Strings; cleanText + Tag-Normalisierung).
- Products API finalisiert immer: finalizeEfroProducts() auf alle Quellen (Shopify/Repo/Supabase/Loader/Mock).
- API erzwingt UTF-8 JSON Antwort: Content-Type: application/json; charset=utf-8.

Guard:
- scripts/guard-mojibake.mjs + pnpm guard:mojibake
- Guard läuft als Commit-Check und blockt Commits, wenn Mojibake wieder auftaucht.

Bonus (Line Endings):
- .gitattributes verschärft (LF erzwungen) + Repo renormalisiert.
- Empfohlen lokal: core.autocrlf=false, core.eol=lf, core.safecrlf=warn



