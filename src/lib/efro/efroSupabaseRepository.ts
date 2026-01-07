// src/lib/efro/efroSupabaseRepository.ts
//
// Zentrale Repository-Datei für EFRO-Supabase-Zugriffe.
// Bündelt alle Datenbank-Operationen für Shops, Produkte und Antwort-Cache.
//
// WICHTIG: Nur serverseitige Funktionen (verwendet SERVICE_ROLE_KEY).
// NICHT im Browser verwenden!

import { getEfroSupabaseServerClient } from "./supabaseServer";

/**
 * Prüft, ob wir serverseitig sind (Node.js-Umgebung mit SERVICE_ROLE_KEY verfügbar)
 */
function isServerSide(): boolean {
  return (
    typeof window === "undefined" &&
    typeof process !== "undefined" &&
    !!(process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)
  );
}

// ============================================================================
// TYPEN
// ============================================================================

export interface EfroShop {
  id: string;
  shopDomain: string;
  brandName?: string | null;
  mainCategory?: string | null;
  targetAudience?: string | null;
  priceLevel?: string | null;
  isDemo?: boolean | null;
  locale?: string | null;
  currency?: string | null;
}

/**
 * EfroProduct für Repository (DB-Struktur).
 * Kompatibel mit mockCatalog.EfroProduct, aber mit zusätzlichen DB-Feldern.
 */
export interface EfroProduct {
  id: string;
  shopId?: string | null;
  title: string;
  description: string; // Immer String (leerer String als Fallback), kompatibel mit mockCatalog
  price: number; // Immer number (0 als Fallback), kompatibel mit mockCatalog
  currency?: string | null;
  category?: string;
  tags?: string[];
  imageUrl?: string;
  productUrl?: string | null;
  rating?: number;
  popularityScore?: number;
}

export interface EfroCachedResponse {
  id: string;
  shopId: string;
  questionHash: string;
  questionText: string;
  locale: string;
  replyText: string;
  products: any | null;
  hitCount: number;
  createdAt: string;
  lastUsedAt: string;
}

// ============================================================================
// SHOP-FUNKTIONEN
// ============================================================================

/**
 * Holt einen Shop anhand der shopDomain aus der efro_shops-Tabelle.
 * Gibt null zurück, wenn kein Eintrag gefunden wird oder ein Fehler auftritt.
 */
export async function getEfroShopByDomain(
  shopDomain: string
): Promise<EfroShop | null> {
  try {
    // Im Browser über API-Route laufen lassen
    if (!isServerSide()) {
      try {
        const res = await fetch(
          `/api/efro/repository/shop?shopDomain=${encodeURIComponent(shopDomain)}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          console.error("[EFRO Repo] API error", { status: res.status });
          return null;
        }
        const data = await res.json();
        return data.ok ? data.shop : null;
      } catch (err: any) {
        console.error("[EFRO Repo] Fetch error", err);
        return null;
      }
    }

    // Serverseitig: Direkt Supabase-Client verwenden
    const supabase = getEfroSupabaseServerClient();
    if (!supabase) {
      console.error("[EFRO Repo] Supabase-Client nicht verfügbar");
      return null;
    }

    const normalizedDomain = shopDomain.trim().toLowerCase();

    const { data, error } = await supabase
      .from("efro_shops")
      .select("*")
      .eq("shop_domain", normalizedDomain)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[EFRO Repo] getEfroShopByDomain error", {
        shopDomain: normalizedDomain,
        error: error.message,
      });
      return null;
    }

    if (!data) {
      // Fallback: Wenn shopDomain wie 'demo' aussieht, versuche getEfroDemoShop
      if (normalizedDomain === "demo" || normalizedDomain.includes("demo")) {
        console.log(
          "[EFRO Repo] Shop nicht gefunden, versuche Demo-Shop-Fallback",
          { shopDomain: normalizedDomain }
        );
        return await getEfroDemoShop();
      }
      return null;
    }

    // Mappe DB-Felder zu EfroShop
    return {
      id: data.id || "",
      shopDomain: data.shop_domain ?? normalizedDomain,
      brandName: data.brand_name ?? null,
      mainCategory: data.main_category ?? null,
      targetAudience: data.target_audience ?? null,
      priceLevel: data.price_level ?? null,
      isDemo: data.is_demo ?? null,
      locale: data.locale ?? data.language ?? null,
      currency: data.currency ?? null,
    };
  } catch (error) {
    console.error("[EFRO Repo] getEfroShopByDomain unexpected error", {
      shopDomain,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Holt den Demo-Shop aus efro_shops.
 * Sucht nach is_demo = true oder shop_domain = 'test-shop.myshopify.com' / 'demo'.
 */
export async function getEfroDemoShop(): Promise<EfroShop | null> {
  try {
    // Im Browser über API-Route laufen lassen
    if (!isServerSide()) {
      try {
        const res = await fetch(`/api/efro/repository/shop?isDemo=true`, {
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("[EFRO Repo] API error", { status: res.status });
          return null;
        }
        const data = await res.json();
        return data.ok ? data.shop : null;
      } catch (err: any) {
        console.error("[EFRO Repo] Fetch error", err);
        return null;
      }
    }

    // Serverseitig: Direkt Supabase-Client verwenden
    const supabase = getEfroSupabaseServerClient();
    if (!supabase) {
      console.error("[EFRO Repo] Supabase-Client nicht verfügbar");
      return null;
    }

    // Versuche zuerst is_demo = true
    const { data, error } = await supabase
      .from("efro_shops")
      .select("*")
      .eq("is_demo", true)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[EFRO Repo] getEfroDemoShop error (is_demo)", {
        error: error.message,
      });
    }

    if (data) {
      return {
        id: data.id || "",
        shopDomain: data.shop_domain ?? "demo",
        brandName: data.brand_name ?? null,
        mainCategory: data.main_category ?? null,
        targetAudience: data.target_audience ?? null,
        priceLevel: data.price_level ?? null,
        isDemo: true,
        locale: data.locale ?? data.language ?? null,
        currency: data.currency ?? null,
      };
    }

    // Fallback: Suche nach bekannten Demo-Domains
    const demoDomains = ["demo", "test-shop.myshopify.com"];
    for (const domain of demoDomains) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("efro_shops")
        .select("*")
        .eq("shop_domain", domain)
        .limit(1)
        .maybeSingle();

      if (!fallbackError && fallbackData) {
        return {
          id: fallbackData.id || "",
          shopDomain: fallbackData.shop_domain ?? domain,
          brandName: fallbackData.brand_name ?? null,
          mainCategory: fallbackData.main_category ?? null,
          targetAudience: fallbackData.target_audience ?? null,
          priceLevel: fallbackData.price_level ?? null,
          isDemo: true,
          locale: fallbackData.locale ?? fallbackData.language ?? null,
          currency: fallbackData.currency ?? null,
        };
      }
    }

    console.warn("[EFRO Repo] Kein Demo-Shop gefunden");
    return null;
  } catch (error) {
    console.error("[EFRO Repo] getEfroDemoShop unexpected error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// PRODUKT-FUNKTIONEN
// ============================================================================

/**
 * Ergebnis von getProductsForShop mit Quelle-Information
 */
export interface GetProductsForShopResult {
  products: EfroProduct[];
  source: "products" | "products_demo";
}

/**
 * Holt Produkte für einen Shop.
 * - IMMER zuerst products-Tabelle abfragen (mit shop_uuid-Filter, falls vorhanden)
 * - Nur wenn products 0 Zeilen zurückgibt: Fallback zu products_demo
 * 
 * @returns GetProductsForShopResult mit products und source
 */
export async function getProductsForShop(
  shop: EfroShop
): Promise<GetProductsForShopResult> {
  try {
    // Im Browser über API-Route laufen lassen
    if (!isServerSide()) {
      try {
        const res = await fetch(`/api/efro/repository/products`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shop }),
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("[EFRO Repo] API error", { status: res.status });
          return { products: [], source: "products_demo" };
        }
        const data = await res.json();
        if (data.ok) {
          return {
            products: data.products || [],
            source: data.source || "products",
          };
        }
        return { products: [], source: "products_demo" };
      } catch (err: any) {
        console.error("[EFRO Repo] Fetch error", err);
        return { products: [], source: "products_demo" };
      }
    }

    // Serverseitig: Direkt Supabase-Client verwenden
    const supabase = getEfroSupabaseServerClient();
    if (!supabase) {
      console.error("[EFRO Repo] Supabase-Client nicht verfügbar");
      return { products: [], source: "products_demo" };
    }

    // 1. Hauptquelle: products-Tabelle (IMMER zuerst)
    // Versuche zuerst mit shop_uuid-Filter (falls shop.id vorhanden)
    let productsData: any[] | null = null;
    let productsError: any = null;

    if (shop.id) {
      // Versuche mit shop_uuid-Filter
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_uuid", shop.id)
        .order("title", { ascending: true })
        .limit(200);
      
      productsData = data;
      productsError = error;
    } else {
      // Kein shop.id: Lade alle Produkte (ohne shop_uuid-Filter)
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("title", { ascending: true })
        .limit(200);
      
      productsData = data;
      productsError = error;
    }

    if (productsError) {
      console.warn("[EFRO Repo] Fehler beim Laden aus 'products':", {
        error: productsError.message,
        shopId: shop.id,
      });
    }

    // Wenn products Daten zurückgibt (> 0), diese verwenden
    if (productsData && productsData.length > 0) {
      const mappedProducts = productsData.map(mapRowToEfroProduct);
      console.log("[EFRO Repo] Produkte aus 'products' geladen:", {
        count: mappedProducts.length,
        shopId: shop.id,
        shopDomain: shop.shopDomain,
        sample: mappedProducts.slice(0, 5).map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
        })),
      });
      return { products: mappedProducts, source: "products" };
    }

    // 2. Fallback: products_demo (nur wenn products 0 Zeilen zurückgibt)
    const { data: demoData, error: demoError } = await supabase
      .from("products_demo")
      .select("*")
      .order("title", { ascending: true })
      .limit(200);

    if (demoError) {
      console.warn("[EFRO Repo] Fehler beim Laden aus 'products_demo':", {
        error: demoError.message,
      });
    }

    const demoCount = demoData?.length ?? 0;
    console.log("[EFRO Repo] Fallback: Produkte aus 'products_demo' geladen:", {
      count: demoCount,
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      reason: productsData?.length === 0 ? "products leer" : "products Fehler",
    });

    if (!demoData || demoData.length === 0) {
      console.warn("[EFRO Repo] Auch 'products_demo' ist leer");
      return { products: [], source: "products_demo" };
    }

    const mappedDemoProducts = demoData.map(mapRowToEfroProduct);
    console.log("[EFRO Repo] Fallback: Produkte aus 'products_demo' geladen:", {
      count: mappedDemoProducts.length,
      shopId: shop.id,
      shopDomain: shop.shopDomain,
      reason: productsData?.length === 0 ? "products leer" : "products Fehler",
      sample: mappedDemoProducts.slice(0, 5).map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
      })),
    });

    return { products: mappedDemoProducts, source: "products_demo" };
  } catch (error) {
    console.error("[EFRO Repo] getProductsForShop unexpected error", {
      shopId: shop.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { products: [], source: "products_demo" };
  }
}

/**
 * Mappt einen Supabase-Row zu EfroProduct.
 * Defensiv: viele Fallbacks für verschiedene Tabellen-Schemas.
 */
function mapRowToEfroProduct(row: any): EfroProduct {
  const id =
    (row.id && String(row.id)) ||
    row.handle ||
    row.sku ||
    `product-${Math.random().toString(36).slice(2)}`;

  const title =
    row.title ||
    row.name ||
    row.product_title ||
    row.product_name ||
    "Unnamed product";

  const description =
    row.description ||
    row.body_html ||
    row.product_description ||
    ""; // Leerer String statt null, um Kompatibilität mit mockCatalog-EfroProduct zu gewährleisten

  // Preis als number (immer number, 0 als Fallback für Kompatibilität)
  let price = 0;
  if (typeof row.price === "number") {
    price = row.price;
  } else if (typeof row.price === "string") {
    const parsed = parseFloat(row.price.replace(",", "."));
    if (!Number.isNaN(parsed)) price = parsed;
  }

  const imageUrl =
    row.image_url ||
    row.imageUrl ||
    row.main_image ||
    row.featured_image ||
    row.featuredimage ||
    undefined; // undefined statt null für Kompatibilität mit mockCatalog

  let tags: string[] | undefined = undefined;
  if (Array.isArray(row.tags)) {
    tags = row.tags;
  } else if (typeof row.tags === "string") {
    tags = row.tags
      .split(",")
      .map((t: string) => t.trim())
      .filter(Boolean);
  }

  const category =
    row.category ||
    row.product_type ||
    undefined; // undefined statt null für Kompatibilität

  const productUrl =
    row.product_url ||
    row.url ||
    row.handle
      ? `/${row.handle}`
      : null;

  return {
    id,
    shopId: row.shop_uuid ?? null,
    title,
    description,
    price,
    currency: row.currency ?? null,
    category,
    tags,
    imageUrl,
    productUrl,
  };
}

// ============================================================================
// CACHE-FUNKTIONEN
// ============================================================================

/**
 * Holt eine gecachte Antwort aus cache_responses.
 * Bei Treffer: erhöht hit_count und aktualisiert last_used_at.
 */
export async function getCachedResponse(params: {
  shopId: string;
  questionHash: string;
  locale?: string;
}): Promise<EfroCachedResponse | null> {
  try {
    // Im Browser über API-Route laufen lassen
    if (!isServerSide()) {
      try {
        const url = `/api/efro/repository/cache?shopId=${encodeURIComponent(
          params.shopId
        )}&questionHash=${encodeURIComponent(
          params.questionHash
        )}&locale=${encodeURIComponent(params.locale || "de")}`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          console.error("[EFRO Repo] API error", { status: res.status });
          return null;
        }
        const data = await res.json();
        return data.ok ? data.cached : null;
      } catch (err: any) {
        console.error("[EFRO Repo] Fetch error", err);
        return null;
      }
    }

    // Serverseitig: Direkt Supabase-Client verwenden
    const supabase = getEfroSupabaseServerClient();
    if (!supabase) {
      console.error("[EFRO Repo] Supabase-Client nicht verfügbar");
      return null;
    }

    const locale = params.locale || "de";

    const { data, error } = await supabase
      .from("cache_responses")
      .select("*")
      .eq("shop_id", params.shopId)
      .eq("question_hash", params.questionHash)
      .eq("locale", locale)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[EFRO Repo] getCachedResponse error", {
        shopId: params.shopId,
        questionHash: params.questionHash,
        locale,
        error: error.message,
      });
      return null;
    }

    if (!data) {
      return null;
    }

    // Bei Treffer: hit_count++ und last_used_at aktualisieren
    await supabase
      .from("cache_responses")
      .update({
        hit_count: (data.hit_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    // Mappe DB-Felder zu EfroCachedResponse
    return {
      id: data.id || "",
      shopId: data.shop_id || params.shopId,
      questionHash: data.question_hash || params.questionHash,
      questionText: data.question_text || "",
      locale: data.locale || locale,
      replyText: data.reply_text || "",
      products: data.products ?? null,
      hitCount: (data.hit_count || 0) + 1,
      createdAt: data.created_at || new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[EFRO Repo] getCachedResponse unexpected error", {
      shopId: params.shopId,
      questionHash: params.questionHash,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Speichert oder aktualisiert eine gecachte Antwort in cache_responses.
 * Verwendet ON CONFLICT (shop_id, question_hash, locale) für Upsert.
 */
export async function upsertCachedResponse(params: {
  shopId: string;
  questionHash: string;
  questionText: string;
  locale?: string;
  replyText: string;
  products: any; // Liste der empfohlenen Produkte (IDs + Basisdaten)
}): Promise<void> {
  try {
    // Im Browser über API-Route laufen lassen
    if (!isServerSide()) {
      try {
        const res = await fetch(`/api/efro/repository/cache`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
          cache: "no-store",
        });
        if (!res.ok) {
          console.error("[EFRO Repo] API error", { status: res.status });
        }
        return;
      } catch (err: any) {
        console.error("[EFRO Repo] Fetch error", err);
        return;
      }
    }

    // Serverseitig: Direkt Supabase-Client verwenden
    const supabase = getEfroSupabaseServerClient();
    if (!supabase) {
      console.error("[EFRO Repo] Supabase-Client nicht verfügbar");
      return;
    }

    const locale = params.locale || "de";

    // Prüfe, ob bereits ein Eintrag existiert
    const { data: existing } = await supabase
      .from("cache_responses")
      .select("hit_count")
      .eq("shop_id", params.shopId)
      .eq("question_hash", params.questionHash)
      .eq("locale", locale)
      .maybeSingle();

    // Wenn existierend: hit_count inkrementieren, sonst 0
    const newHitCount = existing ? (existing.hit_count || 0) + 1 : 0;

    // Upsert: Supabase erkennt automatisch Unique Constraint (shop_id, question_hash, locale)
    // Falls die Tabelle keinen Unique Constraint hat, wird ein neuer Eintrag erstellt
    const { error } = await supabase.from("cache_responses").upsert(
      {
        shop_id: params.shopId,
        question_hash: params.questionHash,
        question_text: params.questionText,
        locale,
        reply_text: params.replyText,
        products: params.products,
        hit_count: newHitCount,
        last_used_at: new Date().toISOString(),
      },
      {
        // Supabase erkennt automatisch Primary Key oder Unique Constraint
        // Falls explizit nötig, kann hier ein onConflict-Handler verwendet werden
      }
    );

    if (error) {
      console.error("[EFRO Repo] upsertCachedResponse error", {
        shopId: params.shopId,
        questionHash: params.questionHash,
        locale,
        error: error.message,
      });
    } else {
      console.log("[EFRO Repo] upsertCachedResponse success", {
        shopId: params.shopId,
        questionHash: params.questionHash,
        locale,
        hitCount: newHitCount,
      });
    }
  } catch (error) {
    console.error("[EFRO Repo] upsertCachedResponse unexpected error", {
      shopId: params.shopId,
      questionHash: params.questionHash,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// DOKUMENTATION
// ============================================================================

/**
 * DOKUMENTATION:
 *
 * Verwendete Tabellen:
 * - efro_shops: Shop-Metadaten (shop_domain, brand_name, main_category, is_demo, etc.)
 * - products: Produkte mit shop_uuid (optional, falls vorhanden)
 * - products_demo: Demo-Produktkatalog (id, category, title, description, price)
 * - cache_responses: Antwort-Cache (shop_id, question_hash, question_text, reply_text, products, hit_count, locale, created_at, last_used_at)
 *
 * Vorausgesetzte Felder:
 * - efro_shops: id, shop_domain, brand_name, main_category, target_audience, price_level, is_demo, locale/language, currency
 * - products: id, shop_uuid (optional, uuid), title, description, price, category, tags, image_url, product_url/url/handle
 * - products_demo: id, category, title, description, price (weitere Felder optional)
 * - cache_responses: id, shop_id, question_hash, question_text, reply_text, products (JSONB), hit_count, locale, created_at, last_used_at
 *   - WICHTIG: Unique Constraint auf (shop_id, question_hash, locale) erforderlich für korrektes Upsert-Verhalten
 *
 * Hinweise:
 * - Alle Funktionen sind serverseitig (verwenden SERVICE_ROLE_KEY).
 * - Defensive Guards: Fehler werden geloggt, aber nicht geworfen (null/[] zurückgegeben).
 * - getEfroShopByDomain hat Fallback zu getEfroDemoShop, wenn shopDomain wie 'demo' aussieht.
 * - getProductsForShop: IMMER zuerst products-Tabelle (mit shop_uuid-Filter, falls vorhanden),
 *   nur bei 0 Ergebnissen Fallback zu products_demo. Auch für Demo-Shops wird zuerst products geladen.
 * - Cache-Funktionen erhöhen hit_count automatisch bei getCachedResponse.
 */

