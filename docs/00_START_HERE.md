# EFRO – Start Here (SSOT)

Regel: Wenn etwas nicht in den Docs steht oder nicht durch Evidence belegt ist, gilt es als ungeprüft.

## 1) Source of Truth
- docs/EFRO_CONTROL_CENTER.md  (Struktur + Regeln)
- docs/SSOT_EVIDENCE.md        (auto-generated Ist-Stand, reproduzierbar)

## 2) Evidence neu erzeugen (immer vor Entscheidungen)
./scripts/ssot-scan.sh

## 3) Arbeitsweise (immer)
- Befehl → Ausgabe → nächster Befehl
- Keine verdeckten Refactors
- Vor riskanten Änderungen: Backup/Checkpoint
- Nur live-relevante Fixes + Go-Live Gates

## 4) Neuer Chat – Copy/Paste Header
KONTEXT-HEADER (immer oben lassen)
Datum/Stand: YYYY-MM-DD
Repo: ~/work/efro_work_fixed
Branch: <name>
Arbeitsweise: Befehl → Ausgabe → nächster Befehl. Keine verdeckten Refactors.
Vor riskanten Änderungen: Backup/Checkpoint.
SOURCE OF TRUTH: docs/EFRO_CONTROL_CENTER.md + docs/SSOT_EVIDENCE.md (aus GitHub laden).
Ziel: nur live-relevante Fixes + Go-Live Gates 3/3.
Aktueller Fehler: <exakter Log>
