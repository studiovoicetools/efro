Schema & Regeln für curated-Szenarien

- Files:
  - curated-core-388.json (Core subset, ~388 entries vor Expansion)
  - curated-live-612.json (Live subset, ~612 entries vor Expansion)
- Format: JSON-Array von Szenario-Objekten, minimal:
  - { "id": "unique-id", "query": "text" }
  - optional: "variantQueries": ["q1","q2",...]
- Regeln:
  - Kein automatisches Auffüllen / kein Smoke-Fill.
  - Varianten-Expansion wie bisher (variantQueries / variants).
  - Gesamtzahl nach Expansion muss exakt 1000.
  - Wenn EFRO_SCENARIO_TARGET > 0 gesetzt ist => FAIL (Curated darf nie künstlich gefüllt werden).
  - Nur Testinfrastruktur ändern, keine SellerBrain-Logik.
