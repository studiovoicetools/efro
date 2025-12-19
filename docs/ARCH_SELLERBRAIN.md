# ARCH: SellerBrain

This document contains the SellerBrain architecture evidence from the repo and highlights unknowns.

Mini-TOC

- [Evidence of orchestrator usage](#evidence-of-orchestrator-usage-tests--runners)
- [SellerBrain implementation file](#sellerbrain-implementation-file)
- [Architecture summary](#architecture-what-we-can-assert-from-evidence)
- Related docs: [EFRO System Map](EFRO_SYSTEM_MAP.md), [Baustellen](BAUSTELLEN.md), [OPS Runbook](OPS_RUNBOOK.md)

## Evidence of orchestrator usage (tests / runners)

- Runner that calls SellerBrain:
  - File: scripts/test-sellerBrain-scenarios.ts
  - Evidence excerpt (call site):
    const result: SellerBrainResult = await runSellerBrain(
      test.query,
      initialIntent,
      products,
      plan,
      previousRecommended,
      sellerContext
    );
  - Location: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios.ts (top/usage)

- Curated runner:
  - File: scripts/test-sellerBrain-scenarios-curated.ts
  - Evidence: imports same runSellerBrain and performs validation/expansion of curated JSONs
  - Location: c:\efro_fast\efro_work_fixed\scripts\test-sellerBrain-scenarios-curated.ts

## SellerBrain implementation file
- Import evidence:
  import { runSellerBrain, type SellerBrainResult, type SellerBrainContext } from "../src/lib/sales/sellerBrain";
  - Seen in: scripts/test-sellerBrain-scenarios.ts, scripts/test-sellerBrain-scenarios-curated.ts
- Implementation file path (expected): src/lib/sales/sellerBrain.ts
- Search result: UNBEKANNT — the actual implementation file was not present in the working set provided.
  - Search performed for filenames/exports: "sellerBrain", "runSellerBrain", "createRecommendations", "handleUserTextInput" across src/.
  - Top related files encountered during searches (candidates to open, in priority order):
    1. src/lib/sales/modules/filter/index.ts (we edited this file)
    2. src/lib/sales/salesTypes.ts (imported by tests)
    3. src/lib/products/mockCatalog.ts (imported by tests)
    4. src/lib/products/efroProductLoader.ts (referenced by test-loadProducts-scenarios.ts)
    5. scripts/test-sellerBrain-scenarios.ts (runner)
    6. scripts/test-sellerBrain-scenarios-curated.ts (curated runner)
    7. scripts/lib/loadDebugProducts.ts (loader)
    8. src/lib/sales/modules/* (filters, utils) — inspect directory if exists
    9. src/app/api/efro/debug-products/route.ts (fixture/live API)
    10. scripts/fixtures/products.local.json

## Architecture (what we can assert from evidence)
- Orchestrator: runSellerBrain function is invoked by scenario runners with parameters:
  - (userQuery, initialIntent, products, plan, previousRecommended, sellerContext)
  - Evidence: scripts/test-sellerBrain-scenarios.ts (see call excerpt above).
- Modules likely used (inferred from imports in tests and modules present):
  - filters (src/lib/sales/modules/filter) — present and modified.
  - pricing / priceRangeInfo — referenced fields in SellerBrainResult evaluated by tests (result.priceRangeInfo).
  - intent detection — tests assert result.intent, expectIntent values in ScenarioTest.expected.
  - SalesAction / sales policy — tests reference result.sales?.primaryAction and expectedNotesIncludes (see salesTypes import in tests).
- HOWEVER: internal module file-level evidence (exact filenames, functions) — UNBEKANNT (implementation not in working set).

## TODO / Next steps to document internals
- Provide src/lib/sales/sellerBrain.ts (or indicate path) to extract:
  - exact module breakdown (intent detection, budget parsing, ranking)
  - where price caps (e.g., cheapest snowboard <= 700) are enforced
  - which inputs/outputs (SellerBrainResult shape) are produced

