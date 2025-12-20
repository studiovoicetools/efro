(1) DOKU (Copy/Paste): EFRO Products – Datenfluss, Quellen, Fallbacks, Encoding

Datei-Vorschlag: docs/products-dataflow.md (oder in dein Ops-Runbook unter „Products API“)

# EFRO Products API – Datenfluss (Shopify / Supabase / Mock) + Debugging

## Ziel
`GET /api/efro/products?shop=<shopDomain>` liefert **EfroProduct[]** in sauberem Shape:
`{ id, title, description, price, imageUrl, tags[], category }`

Dabei wird je nach Umgebung und Datenlage automatisch zwischen Quellen gewechselt.

---

## Wichtige Endpoints
- `/api/efro/products?shop=<domain>`
  - Haupt-Endpoint für Widget/Avatar-Seller.
- `/api/efro/shops`
  - Zeigt installierte Shops (Supabase `efro_shops`).
- `/api/supabase-products`
  - Liefert Produktliste aus Supabase (lokale Demo-/Testprodukte, aktuell 49).

Optional (Demo/Tests):
- `/api/shopify-products`
  - Shopify-Demo-Proxy/Mock für `shop=demo`.

---

## Quellen + Reihenfolge (Entscheidungslogik)

### 1) Sonderfall: `shop=demo`
In `src/app/api/efro/products/route.ts` gilt:
- Versuch: `GET /api/shopify-products`
- Wenn nicht OK / leer / Fehler => Fallback auf `mockCatalog`
- Rückgabe: `source = "shopify"` oder `source = "mock"`

### 2) Normalfall: Shop-Domain (z. B. `test-shop.myshopify.com`)
Reihenfolge:

**(A) Repo (Supabase Repository)**
- `getEfroShopByDomain(shopDomain)` → Shop-Kontext
- `getProductsForShop(shop)` → Repo-Produkte
- Wenn Repo-Produkte vorhanden: return  
  `source = repoResult.source` (z. B. "supabase" / "shopify" je nach Repo-Implementierung)

**(B) Supabase-Fallback (lokale Supabase-Produkte)**
- Falls Repo leer oder nicht greift:
- `tryFetchSupabaseProducts(baseUrl)` → `GET /api/supabase-products`
- Wenn Produkte vorhanden: return  
  `source = "supabase-fallback"`

**(C) Finaler Fallback: Loader**
- `loadProductsForShop(shopDomain || null)`
- Rückgabe kann Shopify/Mock enthalten (je nach Loader-Logik)
- `source` kommt aus dem Loader-Result

---

## Warum taucht manchmal "mock" auf?
Wenn für die übergebene `shop=` Domain im Repository keine Produkte gefunden werden
oder die Repo-Logik nicht greift, fällt der Flow auf (B) oder (C) zurück.

Wenn (B) noch nicht eingebaut/greift oder Supabase leer wäre, landet man leicht bei (C),
und je nach Loader-Konfiguration ist das dann "mock".

Aktueller Sollzustand für echte lokale Tests:
- `shop=test-shop.myshopify.com` => **source = "supabase-fallback"** und count = **49**

---

## Normalisierung: IDs, Shapes, Tags, Encoding
In `route.ts` wird alles auf **EfroProduct** normalisiert über:
- `normalizeEfroProductShape(p)`
  - ID-Fallback: `p.id ?? p.product_id ?? p.handle ?? p.sku`
  - Title-Fallback: `p.title ?? p.name`
  - Preis: `p.price` als float
  - imageUrl: `imageUrl/image_url/image/...`
  - tags: CSV oder Array zu `string[]`
- Wichtig: Ein Fall existierte mit `id: ""` in Supabase-Produkten.
  - Dadurch kam es kurzzeitig zu **48 statt 49**.
  - Durch ID-Fallback (z. B. `sku`) ist es wieder **49**.

### Encoding / “Mojibake”
Es gab Strings wie `fÃ¼r`, `KÃ¼che`, `Ã¢âÂ¬`.
Ursachen:
- Unterschiedliche Anzeige/Decoding in Tools (PowerShell vs Node)
- oder kaputt gespeicherte Texte aus anderen Quellen.

Aktuell zeigen Node-Checks: **supabase-fallback liefert sauber**, `bad=0`.
`repairMojibakeUtf8()` ist in `route.ts` als Safety-Net drin, aber für Supabase-Fallback aktuell nicht mehr zwingend notwendig.

---

## Schnelltests (Copy/Paste)

### A) Welche Quelle liefert /api/efro/products?
Node (zuverlässig):
```bash
node -e "fetch('http://localhost:3000/api/efro/products?shop=test-shop.myshopify.com').then(r=>r.json()).then(j=>console.log({source:j.source,count:j.products?.length,sample:j.products?.[0]?.title}))"


Soll: { source: 'supabase-fallback', count: 49, ... }

B) Mojibake-Check (zuverlässig)
node -e "(async()=>{const j=await (await fetch('http://localhost:3000/api/efro/products?shop=test-shop.myshopify.com')).json(); const bad=(j.products||[]).filter(p=>/Ã|Â|�/.test(String(p.title||'')+String(p.description||''))); console.log('source=',j.source,'count=',j.products?.length,'bad=',bad.length);})()"


Soll: bad=0

C) Supabase-Produkte direkt
node -e "fetch('http://localhost:3000/api/supabase-products').then(r=>r.json()).then(j=>console.log({count:j.products?.length,sample:j.products?.[0]?.title}))"


Soll: count=49

Hinweis zu PowerShell

PowerShell (Invoke-RestMethod / Invoke-WebRequest) kann je nach Konsole/Encoding die Darstellung verfälschen.
Wenn es um Encoding/“fÃ¼r” geht: immer Node-Check bevorzugen.

Dateien / Orte im Code

src/app/api/efro/products/route.ts (Hauptlogik + Fallback-Reihenfolge)

src/app/api/supabase-products/route.ts (Supabase Test-/Demo-Produkte)

src/lib/efro/efroSupabaseRepository.ts (Shop & Produkte aus Repo)

src/lib/products/efroProductLoader.ts (finaler Loader-Fallback)

src/lib/sales/modules/utils/textUtils.ts (normalizeText – separat, nicht zwingend Teil der Products-API)

Bekannte Stolpersteine

Doppelte Helper-Funktionen in route.ts führen zu Next/SWC Build-Error: “defined multiple times”.

Ein einzelnes Produkt ohne ID kann Count verringern, wenn Normalizer strikt filtert.

shop= Parameter entscheidet stark über den Pfad – bei falscher Domain landet man in Mock.


---

## (2) Chat-Zusammenfassung (was passiert ist, was jetzt gilt)

- Ausgangslage: In Produktdaten tauchten kaputte Umlaute/Zeichen auf (`fÃ¼r`, `KÃ¼che`, `Ã¢âÂ¬`).  
- Es wurde ein Mojibake-Fix gebaut (Buffer latin1→utf8; teils mehrfaches „Reparieren“), aber zwischendurch landete der Code **doppelt** in `route.ts` → Next Build Error „defined multiple times“.  
- Danach wurde die `route.ts` konsolidiert und zusätzlich ein **Supabase-Fallback** eingebaut, weil `/api/efro/products?shop=test-shop.myshopify.com` zunächst fälschlich auf **mock** fiel, obwohl Supabase Produkte hatte.  
- Verifikation:  
  - Node-Fetch zeigt zuverlässig: `source = supabase-fallback`, `count = 49`.  
  - Mojibake-Check via Node ergibt: `bad = 0` (für supabase-fallback).  
- Nebenbefund: In `/api/supabase-products` gab es **1 Produkt mit leerer `id`** → dadurch kurz `48`. Durch ID-Fallback (z. B. `sku`) ist es wieder stabil `49`.  
- PowerShell-Anzeige kann irreführend sein (Encoding/Console), daher wurden Node-Checks als Wahrheit genutzt.

Wenn du willst, kann ich dir im nächsten Schritt noch **eine „Minimal-Clean“-Variante** der `route.ts` geben, die nur noch das enthält, was ihr wirklich braucht (ohne überflüssige Reparatur-Schichten) – aber ich ändere jetzt nichts weiter, weil du genau das vermeiden wolltest.
::contentReference[oaicite:0]{index=0}