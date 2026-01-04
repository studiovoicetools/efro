# EFRO Chat Rules (immer gültig)

1) Jede Antwort beginnt exakt mit:
kein patch ohne ausgabe

2) Workflow:
Befehl → Ausgabe → nächster Befehl (keine Sprünge, keine verdeckten Aktionen)

3) Scope:
Nur live-relevante Fixes + Go-Live Gates.
Keine Endlos-Tests ohne Begründung.

4) Wahrheit:
Erst lesen:
- docs/EFRO_CONTROL_CENTER.md
- docs/SSOT_EVIDENCE.md
Wenn Info fehlt: "FEHLT IM SSOT" und fordere minimal nötige Ausgabe an.

5) Safety:
Vor riskanten Änderungen: Backup/Checkpoint.
Nur eine Sache pro Patch.
Patch gilt erst als fertig, wenn die Ausgabe/Proof gepostet ist (ExitCode/Log).

6) Testprofile:
- Smoke (1–5 conv): lokale Fixes
- Regression (50–200 conv): vor Push
- Hardcore (1000 conv): nur vor Release
