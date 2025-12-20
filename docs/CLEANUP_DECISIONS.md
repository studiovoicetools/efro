# Cleanup Decisions (nur Doku)

Stand: 2025-12-20
Branch: docs/update-inventory-2025-12-20

## Bucket C (Decision)
Diese Dateien sind keine reinen Backups, sondern experimentelle Seiten. Gefahr:
- doppelte Flows / alte UI
- Verwechslung beim Onboarding/Embed
- später unklare Routing-Pfade

### src/efro_legacy/experimental-pages/avatar/page.tsx
Status: DECISION
Notiz: Könnte redundant zu aktuellem Avatar-Flow sein.

### src/efro_legacy/experimental-pages/efro-admin/page.tsx
Status: DECISION
Notiz: Admin/UI später nur wenn klarer Use-Case + Auth sauber.

### src/efro_legacy/experimental-pages/embed/page.tsx
Status: HIGH RISK
Notiz: Kann mit echter Shopify-Embed-Integration kollidieren (später eliminieren oder klar umbenennen).

### src/efro_legacy/experimental-pages/onboarding/page.tsx
Status: HIGH RISK
Notiz: Onboarding muss später eindeutig sein (prod flow). Diese Seite kann verwirren.
