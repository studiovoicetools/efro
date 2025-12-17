# CODEX TASK
Goal: 388/388 scenarios PASS
Fails: S2v2, S4v2, S5v1, S5v6, F6v2
Rules:
- minimal changes, no refactor
- BEFORE any file change: print backup commands and wait for my "OK"
- after changes: run pnpm sellerbrain:scenarios and report only the diff + which FAIL fixed
