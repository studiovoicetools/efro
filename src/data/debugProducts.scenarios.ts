// src/data/debugProducts.scenarios.ts
import type { EfroProduct } from "@/lib/products/mockCatalog";
import productsLocal from "../../scripts/fixtures/products.local.json";

/**
 * products.local.json kann entweder
 * A) { "products": [...] } oder
 * B) direkt [...]
 * sein. Wir unterstützen beides.
 */
const raw =
  (productsLocal as any)?.products ??
  (productsLocal as any) ??
  [];

export const debugProductsScenarios: EfroProduct[] = Array.isArray(raw)
  ? raw.map((p: any) => ({
      id: String(p?.id ?? ""),
      title: String(p?.title ?? ""),
      description: String(p?.description ?? p?.title ?? ""),
      // PowerShell zeigt manchmal 79,9 (Locale). In TS bleibt es eine Zahl.
      price:
        typeof p?.price === "number"
          ? p.price
          : Number.parseFloat(String(p?.price ?? "0").replace(",", ".")) || 0,
      imageUrl: String(p?.imageUrl ?? ""),
      tags: Array.isArray(p?.tags)
        ? p.tags
        : typeof p?.tags === "string"
          ? p.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [],
      category: String(p?.category ?? "fixture"),
    }))
  : [];

export default debugProductsScenarios;
