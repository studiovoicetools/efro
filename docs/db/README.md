\# EFRO – Supabase DB Inventory



Diese CSV-Snapshots zeigen den aktuellen Zustand der Supabase DB (public schema).

Sie sind die Source of Truth, um Schema-Drift zu vermeiden.



\## Dateien

\- inventory\_tables.csv: Tabellenliste (public)

\- inventory\_columns.csv: alle Spalten + Datentypen + defaults

\- inventory\_constraints.csv: PK/Unique/FK constraints

\- inventory\_indexes.csv: alle Indizes

\- inventory\_policies.csv: RLS Policies



\## Nutzung

Wenn SQL-Snippets fehlschlagen ("column does not exist"):

1\) inventory\_columns.csv prüfen (echte Spaltennamen)

2\) inventory\_constraints.csv prüfen (für ON CONFLICT braucht man unique/PK)

3\) dann Snippet anpassen und idempotent halten (IF NOT EXISTS / DO $$ BEGIN ... END $$)



