/**
 * Hardcore runner (no HTTP, fixture-first):
 * - uses SCENARIO_PRODUCTS_FIXTURE (snapshot)
 * - delegates to the curated scenario runner (single source of truth)
 */
import { spawnSync } from "node:child_process";

function main() {
  if (!process.env.SCENARIO_PRODUCTS_FIXTURE) {
    console.error("FAIL: SCENARIO_PRODUCTS_FIXTURE not set.");
    console.error("Example: export SCENARIO_PRODUCTS_FIXTURE='scripts/fixtures/products.demo.supabase.json'");
    process.exit(1);
  }

  console.log("=== EFRO HARDCORE ===");
  console.log("fixture =", process.env.SCENARIO_PRODUCTS_FIXTURE);

  const r = spawnSync(
    "npx",
    ["-y", "tsx", "scripts/test-sellerBrain-scenarios-curated.ts"],
    { stdio: "inherit", env: process.env }
  );

  process.exit(r.status ?? 1);
}

main();
