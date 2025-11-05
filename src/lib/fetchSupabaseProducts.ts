export type SupabaseProduct = {
  id: string;
  title: string;
  description?: string;
  price?: number;
  compareAt?: number;
  inventory?: number;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
};

export async function fetchSupabaseProducts({
  q,
  limit = 6,
}: {
  q?: string;
  limit?: number;
}): Promise<{ items: SupabaseProduct[] }> {
  const url = `/api/supabase-products?q=${encodeURIComponent(q || "")}&limit=${limit}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`status ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("âŒ fetchSupabaseProducts:", e);
    return { items: [] };
  }
}

