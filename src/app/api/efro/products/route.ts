export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// src/app/api/efro/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { jsonUtf8 } from "@/lib/http/jsonUtf8";
import { loadProductsForShop, type LoadProductsResult } from "@/lib/products/efroProductLoader";
import { getEfroShopByDomain, getEfroDemoShop, getProductsForShop } from "@/lib/efro/efroSupabaseRepository";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";
import { fixEncodingDeep, normalizeTags, cleanText, sanitizeDeep } from "@/lib/text/encoding";

type ShopifyProduct = {
  id: string | number;
  title: string;
  body_html?: string;
  product_type?: string;
  tags?: string;
  variants?: { price?: string | null }[];
  image?: { src?: string | null } | null;
  images?: { src?: string | null }[];
};


function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * FINAL: normalisiert garantiert die EFRO-Produktform + repariert Encoding + Tags.
 * Diese Funktion ist bewusst "hart" und wird am Ende auf ALLE Outputs angewandt.
 */
function finalizeEfroProducts(raw: unknown): EfroProduct[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: EfroProduct[] = [];

  for (const pAny of arr) {
    if (!pAny || typeof pAny !== "object") continue;

    // Deep-Fix: alle Strings im Objekt reparieren (Ã¤ / â¬ usw.)
    const p = fixEncodingDeep(pAny) as any;

    const idRaw = p.id ?? p.product_id ?? p.handle ?? p.sku ?? "";
    const titleRaw = p.title ?? p.name ?? "";
    if (!idRaw || !titleRaw) continue;

    const title = cleanText(titleRaw);

    const descCandidate =
      (typeof p.body_html === "string" && p.body_html.trim().length > 0 ? stripHtml(p.body_html) : "") ||
      p.description ||
      p.body ||
      title;

    const description = cleanText(descCandidate) || title;

    // Price: versuch mehrere Felder, ansonsten 0
    const price = Number.parseFloat(String(p.price ?? p.price_amount ?? p.amount ?? 0)) || 0;

    const imageUrl = cleanText(
      p.imageUrl ??
        p.image_url ??
        p.image ??
        p.image_src ??
        p.featured_image ??
        p.imageSrc ??
        (p.images && p.images[0]?.src) ??
        ""
    );

    const category = cleanText(p.category ?? p.product_type ?? p.type ?? "unknown") || "unknown";

    // Tags: Array, CSV, Semikolon, etc.
    const tags = normalizeTags(p.tags);

    out.push({
      id: String(idRaw),
      title,
      description,
      price,
      imageUrl: imageUrl || "",
      tags,
      category,
    });
  }

  return out;
}

function mapShopifyToEfro(sp: ShopifyProduct): EfroProduct {
  const priceRaw =
    sp.variants && sp.variants.length > 0 && sp.variants[0]?.price ? sp.variants[0].price! : "0";
  const price = Number.parseFloat(priceRaw) || 0;

  const title = cleanText(sp.title);
  const category =
    cleanText(sp.product_type && sp.product_type.trim().length > 0 ? sp.product_type : "shopify") || "shopify";

  const description = sp.body_html && sp.body_html.trim().length > 0 ? cleanText(stripHtml(sp.body_html)) : title;

  const imageUrl = cleanText((sp.image && sp.image.src) || (sp.images && sp.images[0]?.src) || "") || "";

  const tags = normalizeTags(sp.tags);

  return {
    id: String(sp.id),
    title,
    description,
    price,
    imageUrl,
    tags,
    category,
  };
}

async function tryFetchSupabaseProducts(baseUrl: string): Promise<EfroProduct[] | null> {
  try {
    const res = await fetch(`${baseUrl}/api/supabase-products`, { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const raw = Array.isArray((data as any)?.products) ? (data as any).products : [];
    const normalized = finalizeEfroProducts(raw);

    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams } = url;

  const debug = searchParams.get("debug") === "1";
  const shopDomainRaw = searchParams.get("shop");
  const shopDomain = shopDomainRaw ? shopDomainRaw.trim() : null;

  const baseUrl = `${url.protocol}//${url.host}`;

  // Gate-3 Debug: prefer live Shopify read-after-write for real shops (only when debug=1)
  if (debug && shopDomain && shopDomain.toLowerCase() !== "demo") {
    try {
      const res = await fetch(
        `${baseUrl}/api/shopify-products?shop=${encodeURIComponent(shopDomain)}`,
        { cache: "no-store" }
      );

      if (res.ok) {
        const data = await res.json();
        const rawProducts: ShopifyProduct[] = Array.isArray((data as any).products)
          ? (data as any).products
          : [];

        const products = finalizeEfroProducts(rawProducts.map(mapShopifyToEfro));

        if (products.length > 0) {
          const payload: any = { success: true, source: "shopify", products, shopDomain };
          payload.debug = {
            shopDomain,
            isDemo: false,
            preferredSource: "shopify-live",
            forcedSource: "debug=1",
            tokenSource: (data as any).tokenSource ?? null,
            tokenUpdatedAt: (data as any).tokenUpdatedAt ?? null,
          };
          return jsonUtf8(payload);
        }
      }
    } catch {
      // ignore -> continue normal flow
    }
  }


  try {
    // 1) shop=demo -> Shopify-API (oder mock als fallback)
    if (shopDomain?.toLowerCase() === "demo") {
      try {
        const res = await fetch(`${baseUrl}/api/shopify-products`, { cache: "no-store" });

        if (res.ok) {
          const data = await res.json();
          const rawProducts: ShopifyProduct[] = Array.isArray((data as any).products) ? (data as any).products : [];
          const products = finalizeEfroProducts(rawProducts.map(mapShopifyToEfro));

          const payload: any = { success: true, source: "shopify", products, shopDomain: "demo" };
          if (debug) payload.debug = { shopDomain: "demo", isDemo: true, preferredSource: "shopify", forcedSource: null };
          return jsonUtf8(payload);
        }
      } catch {
        // ignore -> fallback
      }

      const products = finalizeEfroProducts(mockCatalog as any[]);
      const payload: any = { success: true, source: "mock", products, shopDomain: "demo" };
      if (debug) payload.debug = { shopDomain: "demo", isDemo: true, preferredSource: "mock", forcedSource: null };
      return jsonUtf8(payload);
    }

    // 2) Repository (Supabase-Repo) bevorzugen
    let shop = shopDomain ? await getEfroShopByDomain(shopDomain) : null;
    if (!shop) shop = await getEfroDemoShop(); // fallback: irgendein Shop-Kontext

    if (shop) {
      const repoResult = await getProductsForShop(shop);
      const repoProducts = finalizeEfroProducts((repoResult as any)?.products ?? []);

      if (repoProducts.length > 0) {
        const payload: any = {
          success: true,
          source: (repoResult as any)?.source ?? "repo",
          products: repoProducts,
          shopDomain: shopDomain || null,
        };
        if (debug) payload.debug = { shopDomain: shopDomain || null, isDemo: false, preferredSource: "repo", forcedSource: null };
        return jsonUtf8(payload);
      }
    }

    // 3) Supabase products fallback (wenn Repo leer)
    const supaFallback = await tryFetchSupabaseProducts(baseUrl);
    if (supaFallback && supaFallback.length > 0) {
      const payload: any = { success: true, source: "supabase-fallback", products: supaFallback, shopDomain: shopDomain || null };
      if (debug) {
        payload.debug = { shopDomain: shopDomain || null, isDemo: false, preferredSource: "supabase-fallback", forcedSource: null };
      }
      return jsonUtf8(payload);
    }

    // 4) Final fallback: Loader (Shopify/Mock)
    const result: LoadProductsResult = await loadProductsForShop(shopDomain || null);
    const safeProducts = finalizeEfroProducts(((result as any)?.products ?? []) as any[]);

    const payload: any = { ...(result as any), products: safeProducts };
    if (debug) payload.debug = { shopDomain: shopDomain || null, isDemo: false, preferredSource: "loader", forcedSource: null };
    return jsonUtf8(payload);
  } catch (err: any) {
    console.error("[EFRO Products API] Unexpected error", err);

    return jsonUtf8(
      {
        success: false,
        source: "none" as const,
        products: [],
        error: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
