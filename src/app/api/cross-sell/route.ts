// src/app/api/cross-sell/route.ts
import { NextResponse } from "next/server";

/**
 * Liefert passende Cross-Selling-Kategorien zu einer gegebenen Kategorie.
 * In Phase 2 kÃ¶nnen diese Daten direkt aus Supabase gelesen werden.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category")?.toLowerCase() || "";

  const mapping: Record<string, string[]> = {
    hoodie: ["cap", "t-shirt", "jacke"],
    shirt: ["hoodie", "jacke", "hose"],
    jacke: ["hoodie", "mÃ¼tze"],
    cap: ["hoodie", "shirt"],
    snowboard: ["jacke", "handschuhe", "helm"],
  };

  const related = mapping[category] || ["accessoires"];
  return NextResponse.json({ success: true, related });
}

