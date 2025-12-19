export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

// src/app/api/efro/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { loadProductsForShop, type LoadProductsResult } from "@/lib/products/efroProductLoader";
import { getEfroShopByDomain, getEfroDemoShop, getProductsForShop } from "@/lib/efro/efroSupabaseRepository";
import type { EfroProduct } from "@/lib/products/mockCatalog";
import { mockCatalog } from "@/lib/products/mockCatalog";

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

function looksLikeMojibake(s: string): boolean {
  // typische UTF8->Latin1 Fehl-Decodierung + häufige Sonderfälle (€, Anführungszeichen etc.)
  return /Ã|Â|â€|â€™|â€œ|â€�|â€“|â€¦|â‚¬|â¬/.test(s);
}

function repairMojibakeUtf8(input: unknown): string {
  const original = typeof input === "string" ? input : "";
  if (!original) return original;

  let out = original;

  try {
    // runtime=nodejs -> Buffer vorhanden
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const B: any = (globalThis as any).Buffer;

    if (typeof B !== "undefined") {
      // bis zu 3 Durchläufe: manche Strings sind doppelt kaputt (z.B. Ã¢âÂ¬)
      for (let i = 0; i < 3; i++) {
        if (!looksLikeMojibake(out)) break;
        const prev = out;
        out = B.from(out, "latin1").toString("utf8");
        if (out === prev) break;
      }
    }
  } catch {
    // ignore
  }

  // letzte Kante: Euro taucht manchmal als â‚¬ oder â¬ auf
  out = out.replace(/â‚¬/g, "€").replace(/â¬/g, "€");

  return out;
}

function normalizeTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map((t) => repairMojibakeUtf8(t)).map((t) => String(t).trim()).filter(Boolean);

  // Shopify tags kommen oft als CSV-String
  if (typeof tags === "string") {
    const fixed = repairMojibakeUtf8(tags);
    return fixed
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeEfroProductShape(p: any): EfroProduct | null {
  if (!p || typeof p !== "object") return null;

  const idRaw = p.id ?? p.product_id ?? p.handle ?? p.sku ?? "";
  const titleRaw = p.title ?? p.name ?? "";
  if (!idRaw || !titleRaw) return null;

  const title = repairMojibakeUtf8(titleRaw);
  const description = repairMojibakeUtf8(p.description ?? p.body ?? p.body_html ?? title);
  const price = Number.parseFloat(String(p.price ?? p.price_amount ?? 0)) || 0;

  const imageUrl =
    repairMojibakeUtf8(
      p.imageUrl ?? p.image_url ?? p.image ?? p.image_src ?? p.featured_image ?? ""
    ) || "";

  const category = repairMojibakeUtf8(p.category ?? p.product_type ?? p.type ?? "supabase") || "supabase";
  const tags = normalizeTags(p.tags);

  return {
    id: String(idRaw),
    title,
    description: typeof description === "string" && description.trim().length > 0 ? description : title,
    price,
    imageUrl,
    tags,
    category,
  };
}

function repairProducts(products: any[]): EfroProduct[] {
  const out: EfroProduct[] = [];
  for (const p of products || []) {
    const n = normalizeEfroProductShape(p);
    if (n) out.push(n);
  }
  return out;
}

function mapShopifyToEfro(sp: ShopifyProduct): EfroProduct {
  const priceRaw =
    sp.variants && sp.variants.length > 0 && sp.variants[0]?.price ? sp.variants[0].price! : "0";
  const price = Number.parseFloat(priceRaw) || 0;

  const title = repairMojibakeUtf8(sp.title);

  const category =
    sp.product_type && sp.product_type.trim().length > 0 ? repairMojibakeUtf8(sp.product_type) : "shopify";

  const description =
    sp.body_html && sp.body_html.trim().length > 0 ? repairMojibakeUtf8(stripHtml(sp.body_html)) : title;

  const imageUrl = repairMojibakeUtf8((sp.image && sp.image.src) || (sp.images && sp.images[0]?.src) || "") || "";

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
    const raw = Array.isArray(data?.products) ? data.products : [];
    const normalized = repairProducts(raw);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shopDomainRaw = searchParams.get("shop");
    const shopDomain = shopDomainRaw ? shopDomainRaw.trim() : null;

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    // 1) shop=demo -> Shopify-API (oder mock als fallback)
    if (shopDomain?.toLowerCase() === "demo") {
      try {
        const res = await fetch(`${baseUrl}/api/shopify-products`, { cache: "no-store" });
        if (!res.ok) {
          return NextResponse.json({
            success: true,
            source: "mock",
            products: repairProducts(mockCatalog as any[]),
            shopDomain: "demo",
          });
        }

        const data = await res.json();
        const rawProducts: ShopifyProduct[] = Array.isArray(data.products) ? data.products : [];
        if (rawProducts.length === 0) {
          return NextResponse.json({
            success: true,
            source: "mock",
            products: repairProducts(mockCatalog as any[]),
            shopDomain: "demo",
          });
        }

        const products = rawProducts.map(mapShopifyToEfro);
        return NextResponse.json({
          success: true,
          source: "shopify",
          products: repairProducts(products as any[]),
          shopDomain: "demo",
        });
      } catch {
        return NextResponse.json({
          success: true,
          source: "mock",
          products: repairProducts(mockCatalog as any[]),
          shopDomain: "demo",
        });
      }
    }

    // 2) Repository (Supabase-Repo) bevorzugen
    let shop = shopDomain ? await getEfroShopByDomain(shopDomain) : null;
    if (!shop) shop = await getEfroDemoShop(); // fallback nur um "irgendeinen" Shop-Kontext zu haben

    if (shop) {
      const repoResult = await getProductsForShop(shop);
      if (repoResult?.products?.length > 0) {
        return NextResponse.json({
          success: true,
          source: repoResult.source,
          products: repairProducts(repoResult.products as any[]),
          shopDomain: shopDomain || null,
        });
      }
    }

    // 3) WICHTIG: Wenn Repo leer ist, aber Supabase lokal Produkte hat -> supabase-products fallback
    const supaFallback = await tryFetchSupabaseProducts(baseUrl);
    if (supaFallback && supaFallback.length > 0) {
      return NextResponse.json({
        success: true,
        source: "supabase-fallback",
        products: supaFallback,
        shopDomain: shopDomain || null,
      });
    }

    // 4) Final fallback: Loader (Shopify/Mock)
    const result: LoadProductsResult = await loadProductsForShop(shopDomain || null);
    const safeProducts = repairProducts((result?.products || []) as any[]);
    return NextResponse.json({ ...result, products: safeProducts });
  } catch (err: any) {
    console.error("[EFRO Products API] Unexpected error", err);
    return NextResponse.json(
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
