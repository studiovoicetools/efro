#!/usr/bin/env bash
set -euo pipefail

OUT="docs/SSOT_EVIDENCE.md"

sec () { echo "" >> "$OUT"; echo "## $1" >> "$OUT"; echo "" >> "$OUT"; }
codeblock () { echo '```' >> "$OUT"; cat >> "$OUT"; echo '```' >> "$OUT"; }

echo "# SSOT Evidence (auto-generated)" > "$OUT"
echo "" >> "$OUT"
echo "Generated: $(date -Is)" >> "$OUT"
echo "Branch: $(git rev-parse --abbrev-ref HEAD)" >> "$OUT"
echo "Commit: $(git rev-parse --short HEAD)" >> "$OUT"
echo "" >> "$OUT"

sec "GIT_STATUS"
{ git status -sb; echo; git log -1 --oneline; } | codeblock

sec "API_ROUTES"
{ find src/app/api -type f \( -name "route.ts" -o -name "route.tsx" \) 2>/dev/null || true; } | codeblock

sec "ENV_READS"
{ rg -n "process\\.env\\.[A-Z0-9_]+" -S src scripts 2>/dev/null | sort -u || true; } | codeblock

sec "BRAIN_HINTS"
{ rg -n "orchestrator|SellerBrain|brain" -S src/lib/sales 2>/dev/null | head -n 200 || true; } | codeblock

sec "SUPABASE_HINTS"
{ rg -n "createClient|supabase|from\\(" -S src/lib 2>/dev/null | head -n 200 || true; } | codeblock

sec "SHOPIFY_HINTS"
{ rg -n "shopify|OAuth|webhook|billing|stripe" -S src 2>/dev/null | head -n 200 || true; } | codeblock

echo "" >> "$OUT"
echo "DONE." >> "$OUT"
echo "Wrote: $OUT"
