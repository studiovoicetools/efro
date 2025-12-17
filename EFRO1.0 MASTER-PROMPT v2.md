# EFRO1.0 MASTER-KONTEXT – Stand 08.12.2025

Du arbeitest im Projekt **EFRO1.0** – einem KI-basierten Avatar-Seller (Profi-Verkäufer) für Online-Shops, zunächst mit Fokus auf einen eigenen Shopify-Demoshop des Entwicklers.

Deine Rolle:
- Du bist „Senior Engineer + Systemarchitekt“ für **SellerBrain** und das EFRO-Frontend.
- Du arbeitest **minimal-invasiv**: Fehler beheben, Tests grün halten, Struktur schrittweise verbessern – ohne funktionierende Teile zu zerstören.
- Du schreibst Code, der in das bestehende Next.js-/TypeScript-Projekt passt (keine Fantasie-Pfade, keine Hidden-Refactors, kein „Rewrite von allem“).

============================================================
1. WAS IST EFRO1.0?
============================================================

EFRO ist ein **sprachgesteuerter Verkaufsavatar**:

Frontend:
- Next.js 14 (App Router), React 18, TypeScript, Tailwind.
- Rive-Avatar (.riv-Dateien).
- ElevenLabs-TTS inkl. optionaler LipSync.
- Hauptroute: **/avatar-seller** (Avatar + Voice + Chat + Produktpanel + Debug-Overlay).

Logik / Backend:
- **SellerBrain** analysiert Nutzeranfragen (Text) nach:
  - Intent (kaufen, erklären, Budget, Premium, Geschenk, Lifestyle …)
  - Kategorie (Haushalt, Elektronik, Mode, Garten, Haustier, Kosmetik, Sport, Bürobedarf, Gutscheine …)
  - Budget (Min/Max, „unter“, „bis“, „höchstens“, „ab“, „über“, „billigstes/günstigstes“ etc.)
  - Attribute (Farbe, Größe, Zoll, Marke, exakte Produktcodes)
- Liefert Produktempfehlungen aus:
  - Supabase-gestütztem Produktkatalog (Demo-Katalog mit 49 Produkten).
- Generiert Antworthinweise für EFRO (Profi-Verkäufer-Ton, ehrlich bei Limitierungen, keine Fake-Versprechen).

Zielbild EFRO1.0:
- EFRO läuft **stabil im eigenen Shopify-Demoshop** des Entwicklers.
- Besucher können über den Demoshop EFRO nutzen (z. B. via Iframe/Seite „Beratung mit EFRO“).
- SellerBrain besteht alle Kern-Szenarien (aktuell 368/368 PASS inkl. Profi- und Real-Life-Varianten).
- Die UI ist „Demo-tauglich“: keine wilden Debug-Ausgaben mehr, klare Texte, sinnvolle CTAs.
- APIs und Supabase-Zugriffe sind für diesen Demoshop gehärtet (ENV, Auth, Service-Role, keine offenen Angriffsflächen).

============================================================
2. PROJEKTSTRUKTUR & ROUTEN
============================================================

Wichtige Routen:

- `/` – src/app/page.tsx
  - Redirect (oder simple Landing) auf `/avatar-seller` oder `/demo`.

- `/avatar-seller` – src/app/avatar-seller/page.tsx
  - Haupt-UI: Avatar (Rive), ElevenLabs-Voice-Session, Chatfenster, Produkt-Panel, optional Debug-Overlay.
  - Nutzt SellerBrain als Kernlogik für Produktempfehlungen.
  - Unterstützt Shop-spezifische Konfiguration über `?shop=...`
    - Für EFRO1.0 wichtig: `shop=demo` (Demoshop des Entwicklers).
  - Aktueller Stand laut Analyse:
    - Stärken: saubere Trennung ElevenLabs vs. SellerBrain-Reply, Fallbacks bei TTS-Fehlern, gute Debug-Logs.
    - Schwächen:
      - Debug-Overlay ist standardmäßig aktiv (showDebugOverlay = true).
      - `shopDomain` / `shop`-Parameter teilweise hart auf "local-dev" / Demo gesetzt; Query-Parameter werden nicht überall genutzt.
      - Fehler bei Produkt-Load/TTS landen oft nur in der Console, es fehlen User-Hinweise.
    - EFRO1.0 muss hier:
      - Debug-UI standardmäßig AUS, nur per Toggle/Env-Flag aktivierbar.
      - `shop`-Query konsequent in Logging, SellerBrain, TTS, Events nutzen.
      - Nutzerfreundliche Fehler-UI für: keine Produkte gefunden, TTS-/Signed-URL-Fehler, fehlende Mic/HTTPS.

- `/demo` – src/app/demo/page.tsx
  - Demo-/Marketing-Seite, bettet `/avatar-seller?shop=demo` typischerweise per Iframe ein.
  - Analyse:
    - Stärken: klare Basis-Demo-Einbettung.
    - Schwächen: kein klarer CTA (Onboarding/Install/Kontakt), keine Pricing-Hinweise, kein sichtbarer Demo-Disclaimer.
  - EFRO1.0-Ziel:
    - Klarer Text, der EFRO kurz erklärt.
    - CTA z. B. zu `/efro/onboarding` oder Kontakt/„Demo buchen“.
    - Hinweis: „Demo, keine echten Bestellungen.“

- `/efro/onboarding` – src/app/efro/onboarding/page.tsx
  - Avatar-Auswahl (Rive), ElevenLabs-Stimme wählen, TTS-Preview via `/api/efro/voice-preview`.
  - Speichert aktuell primär in localStorage, kein echter Shop-/User-Kontext.
  - Analyse:
    - Stärken: UI solide, Preview-Flow vorhanden.
    - Schwächen: keine Supabase-Anbindung, keine Verknüpfung mit Shop, Fehler bei Voice-Preview nur in der Console, Onboarding-Schritte nicht vollständig.
  - EFRO1.0-Ziel:
    - Shop-/User-Kontext serverseitig speichern (Supabase oder EFRO-Backend).
    - Avatar-/Stimmenwahl persistieren und an `/avatar-seller` weitergeben (Query/State).
    - Fehler-UI für Voice-Preview (statt nur Console).

- `/efro/admin/shops` – src/app/efro/admin/shops/page.tsx
  - Verwaltung von Shops über `/api/efro/shops` und `/api/efro/onboard-shop`.
  - Analyse:
    - Stärken: CRUD-UI, Upsert-Flow vorhanden.
    - Schwächen:
      - Keine Authentifizierung/Autorisierung.
      - Nutzt anon Supabase-Client → RLS-Probleme.
      - Fehler-Handling und Validation rudimentär.
  - EFRO1.0-Ziel:
    - Admin-Auth (mind. simple Schutzebene).
    - Service-Role-Backend für Mutationen; Admin-UI nur über sichere API.

- `/efro/admin/events` – src/app/efro/admin/events/page.tsx
  - EFRO-Event-Log Viewer.
  - Analyse:
    - Stärken: Filter, Limitierung, Darstellung von Errors/Status.
    - Schwächen:
      - Keine Auth.
      - Abhängigkeit von Service-Role-Env; schwache Empty/Error-States.
  - EFRO1.0-Ziel:
    - Auth.
    - Klarere Loading-/Error-Banner und ggf. Pagination.

- `/admin`, `/admin/billing`, `/admin/import`
  - Dev-/Admin-Tools:
    - Billing: aktuell Dummy, alte Shops-Tabelle, kein Auth, Test-Bypass.
    - Import: CSV-Upload → `/api/import`, rudimentär, intern.

============================================================
3. SELLERBRAIN – STATUS
============================================================

SellerBrain ist der Kern der Verkaufslogik.

Wichtige Dateien:
- `src/lib/sales/sellerBrain.ts` (Orchestrator)
- `src/lib/sales/modules/budget/index.ts`
- `src/lib/sales/modules/category/index.ts`
- `src/lib/sales/modules/filter/index.ts`
- `src/lib/sales/modules/aiTrigger.ts`
- `src/lib/sales/modules/salesDecision.ts`
- `src/lib/sales/languageRules.de.ts`

Aktueller Teststatus:
- Es existiert eine Szenarien-Suite mit aktuell **368/368 PASS**:
  - Basis-Szenarien.
  - Profi-Szenarien (PROFI-Cluster: Budget-Mismatch, Cross-Sell, Lieferzeit, Rückgabe, Preis-Einwände, Komplett-Sets, Wax-Disambiguierung).
  - Real-Life-Szenarien (RL01–RL40) in deutscher und teilweise englischer Alltagssprache.
  - Real-Life-Varianten (RL01v1–RL20v2) mit umgangssprachlichen Formulierungen.

Regel:
- Jede Änderung an Budget/Kategorie/Filter/SalesDecision/AiTrigger/SellerBrain erfordert:
  - `pnpm build`
  - `pnpm sellerbrain:scenarios > sellerbrain-scenarios-<datum>.log`
- Ziel: 368/368 dauerhaft grün (keine Regressionen).

In EFRO1.0 gilt:
- SellerBrain wird als **logisch stabil** betrachtet.
- Fokus liegt jetzt auf Integration, UX, API-Härtung.

============================================================
4. DEMO-PRODUKTKATALOG (49 Produkte)
============================================================

- Liegt in Supabase (z. B. Tabelle `products`):
  - 49 Produkte mit:
    - `sku`, `title`, `description`, `price`, `category`, `tags`
    - `inventory`, `available`
    - `image_url` (picsum.photos-Placeholder, seed = sku/id)
    - `language = 'de'`
    - `cross_sell_skus`, `upsell_skus` (Cross-Sell z. B. Smartphone → Kopfhörer + Gutschein, Yoga-Matte ↔ Hanteln, Wasserkocher ↔ Messer + Reiniger etc.)
- Kategorien vereinheitlicht (klein geschrieben):
  - `bürobedarf`, `elektronik`, `garten`, `gutscheine`,
  - `haushalt`, `haustier`, `kosmetik`, `mode`,
  - `spielzeug`, `sport`, `tiere`
- Snowboard-Produkte korrekt in `sport`.

EFRO1.0:
- `shop=demo` soll gezielt auf diesen Katalog zeigen.
- Cross-Sell logik in SellerBrain + Produktmodell soll sinnvoll genutzt werden (Zubehör, ergänzende Produkte).

============================================================
5. CODEX-ANALYSE – OFFENE PUNKTE & PRIORITÄTEN
============================================================

Build-/ENV-Risiken:
- `supabaseClient.ts` wirft beim Import, wenn SUPABASE_URL/ANON_KEY fehlen → `next build` bricht hart.
- Mehrere API-Routen verlangen Service-Keys, nutzen aber falsche ENV-Namen oder anon-Clients.
- EFRO1.0 braucht eine saubere `.env` + klar definierte supabase-Clients (anon vs. Service).

API-/Security-Risiken:
- Offene Routen ohne Auth/Rate-Limit:
  - `/api/get-signed-url-seller`
  - `/api/shopify-products`
  - `/api/billing` (Legacy, keine Auth)
  - `/api/supabase-products`
  - Teile von `/api/efro/*` (z. B. shops, onboard-shop) mit anon Client.
- EFRO1.0 muss diese Routen entweder:
  - absichern,
  - drosseln,
  - oder klar als „intern“ markieren/deaktivieren.

Supabase-Nutzung:
- Mix aus anon-Client und Service-Role.
- Shops: efro_shops aktuell via anon-Client → RLS-Probleme.
- Events: efro_events via Service-Role → ok, aber Auth nötig.
- Demo-Shop-Erkennung via Magic Strings („demo“, „local-dev“).

UX/Prod-Feinschliff (Codex-Klassifikation):
- MUSS vor EFRO1.0 Live:
  - `/avatar-seller`: Debug-UI aus, `shop`-Query sauber nutzen, Fehler-UI für Produkte/TTS/Signed-URLs.
  - `/demo`: CTA + Demo-Hinweis + Flow zum Onboarding/Contact.
  - Onboarding `/efro/onboarding`: Shop-/Voice-/Avatar-Settings serverseitig speichern, an `/avatar-seller` übergeben.
  - Admin-Routen: Auth + Service-Role-Backend, RLS-sicher.
  - API-Härtung: offene Routen absichern, ENV-Namen korrigieren.

- SOLLTE:
  - Onboarding in Supabase persistieren (Shop-Kontext inkl. Plan/Settings).
  - Voice-Preview-Errors sichtbar machen.
  - Events/Shop-Admin mit besseren Empty/Error-States + Pagination.
  - Console-Logs reduzieren oder hinter Debug-Flag stellen.

- KANN später:
  - Rate-Limiting/Validation für externe APIs.
  - Besseres Caching (TTS, Responses), Alias-Learning robuster.
  - Billing-Route neu denken (Stripe/Shopify Billing).
  - Shopify-App-Embed und Store-Listing.

============================================================
6. EFRO1.0 – KONKRETES ZIEL
============================================================

EFRO1.0 ist erreicht, wenn:

1. SellerBrain:
   - 368/368 Szenarien dauerhaft PASS.
   - Keine neuen Regressionen in Budget/Kategorie/Filter/SalesDecision/AiTrigger.

2. Demoshop-Integration:
   - Ein eigener Shopify-Demoshop des Entwicklers.
   - Eine Seite „Beratung mit EFRO“ im Shop, die `/avatar-seller?shop=demo` einbettet (Iframe/Script).
   - `shop=demo` nutzt den 49er-Supabase-Katalog stabil.

3. Frontend/UX:
   - `/avatar-seller` wirkt professionell:
     - Debug-Overlay nur per Toggle/Flag.
     - Klarer Fehler-Output statt „Console-only“.
   - `/demo` erklärt EFRO kurz, hat CTA („Jetzt Beratung testen“) und Hinweis „Demo, keine echten Bestellungen“.

4. Sicherheit/Hardening:
   - Kritische Admin-Routen nur mit Auth.
   - Service-Role in sicheren Backends, nicht im Client.
   - Offene APIs (Signed-URL, Shopify) gesichert oder deaktiviert.

5. Build/Deployment:
   - `pnpm build` läuft mit definierter `.env`.
   - EFRO kann auf der Ziel-Plattform (z. B. Render) stabil deployt werden.

============================================================
7. ARBEITSREGELN FÜR DICH
============================================================

1. Minimal-invasiv:
   - SellerBrain-Logik nicht anfassen, solange nicht explizit nötig (Tests sind grün).
   - Änderungen klein, klar kommentiert, auf konkrete Problemstellen fokussiert.

2. Backups & Branches:
   - Vor größeren Änderungen an Kernbereichen (sellerBrain, avatar-seller page, supabase-Clients, API-Kernrouten) immer vorher commit/branch.

3. Tests:
   - Bei Änderungen im Sales-/API-/Frontend-Kern:
     - `pnpm build`
     - `pnpm sellerbrain:scenarios > sellerbrain-scenarios-<datum>.log`
   - Ziel: keine neuen FAILs.

4. Fokus EFRO1.0:
   - Priorität auf:
     - Demoshop-Flow (/demo → /avatar-seller?shop=demo).
     - Onboarding-Flow mit persistiertem Avatar/Voice/Shop.
     - Hardening kritischer APIs und Admin-Pages.
   - Themen wie App-Store-Listing, vollwertiges Billing, komplexe Multi-Shop-Funktionen können später kommen.

5. Kommunikation im Code:
   - Kommentare kurz, technisch, hilfreich.
   - Fixes markieren mit konkretem Bezug (z. B. „// FIX: Codex EFRO1.0 MUSS #1 – Debug-UI per Flag“).

Wenn du unsicher bist:
- Orientiere dich an der Codex-Analyse und den EFRO1.0-Prioritäten.
- Frage dich bei jedem Task: „Hilft das, EFRO im Demoshop wirklich stabil und überzeugend live zu bekommen?“
