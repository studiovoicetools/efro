# Environment variables (evidence-based)

List of environment variables used in repository code and where referenced.

Mini-TOC

- [Env vars found](#env-vars-found)
- [Render / Deployment note](#render--deployment-note)
- Related files: [.env.example](../.env.example), [render.yaml](../render.yaml)

- EFRO_DEBUG_PRODUCTS_URL
  - Used in: scripts/test-sellerBrain-scenarios.ts
  - Excerpt:
    const DEBUG_PRODUCTS_URL = process.env.EFRO_DEBUG_PRODUCTS_URL ?? "http://localhost:3000/api/efro/debug-products?shop=local-dev";

- EFRO_ALLOW_FIXTURE_FALLBACK
  - Used in: scripts/lib/loadDebugProducts.ts
  - Excerpt:
    const allowFixtureFallback = opts.allowFixtureFallback ?? (process.env.EFRO_ALLOW_FIXTURE_FALLBACK === "1");

- EFRO_SCENARIO_TARGET
  - Used in: scripts/test-sellerBrain-scenarios.ts and curated runner:
    const targetTotal = Number(process.env.EFRO_SCENARIO_TARGET ?? "0");

- SUPABASE_URL and SUPABASE_ANON_KEY
  - Used in: src/app/api/efro/debug-products/route.ts
  - Excerpt:
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

- ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID
  - Expected use: src/app/api/get-signed-url/route.ts (documented in .github/copilot-instructions.md)
  - Actual implementation file: UNBEKANNT (get-signed-url route not found in working set)

- SHOPIFY related envs
  - Search performed for "SHOPIFY_" env usage
  - Result: minimal references (scripts/test-loadProducts-scenarios.ts references SHOPIFY_STORE_DOMAIN)
  - Exact Shopify API key env names in repo: UNBEKANNT

## Notes / Missing
- Confirm names and values of production env vars deployed on Render (render.yaml or Render dashboard) — UNBEKANNT (no render manifest found in repo).

## Render / Deployment note
- `render.yaml` exists at repository root and sets `NODE_VERSION` and `NODE_ENV` for the `efro-prod` service. Other runtime secrets (eg. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ELEVENLABS_API_KEY`) are expected to be configured in the deployment environment (Render service env settings). See `../render.yaml` and `.env.example` for the list of vars referenced by code.

