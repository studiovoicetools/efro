#!/usr/bin/env bash
set -euo pipefail

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")"
DATE_NOW="$(date +%Y-%m-%d)"

cat <<HDR
KONTEXT-HEADER (immer oben lassen)
Datum/Stand: ${DATE_NOW}
Repo: ~/work/efro_work_fixed
Branch: ${BRANCH}
Commit: ${COMMIT}
Arbeitsweise: Befehl → Ausgabe → nächster Befehl. Keine verdeckten Refactors.
Vor riskanten Änderungen: Backup/Checkpoint.
SOURCE OF TRUTH (GitHub, Branch chore/docs-reset-20260104):
- docs/EFRO_CONTROL_CENTER.md
- docs/SSOT_EVIDENCE.md
Regel: Wenn nicht belegt → FEHLT IM SSOT.
HDR
