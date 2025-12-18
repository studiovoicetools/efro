Definition of Done
- Alle relevanten Tests grün (inkl. 388 Core + EFRO-Szenarien).
- `pnpm sellerbrain:scenarios` ausgeführt und failing sections angehängt.
- Nur minimale invasive Änderungen.
- SellerBrain-Regeln eingehalten:
  - "board" allein => ASK_CLARIFICATION + AMBIGUOUS_BOARD
  - günstigstes Snowboard ohne Preis darf <= 700
  - "Premium/über X" Filter darf nicht alle Produkte entfernen
- Deploy-Pipeline (Render) unverändert.
- Produktquelle bleibt Supabase.
