export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  imageUrl: string | null;
  imageAlt: string | null;
  price: string | null;
  compareAtPrice: string | null;
  url: string;
  available: boolean;
}

export async function fetchShopifyProducts({
  q,
  limit = 8,
}: {
  q: string;
  limit?: number;
}): Promise<{ items: ShopifyProduct[]; totalCount: number }> {
  
  console.log("🔄 Starte Produktsuche:", q);
  
  const params = new URLSearchParams();
  params.set("q", q);
  params.set("limit", limit.toString());

  try {
    // DIREKT zu Supabase - keine Umwege
    const res = await fetch(`/api/supabase-products?${params.toString()}`);
    
    console.log("📡 API Response Status:", res.status);
    
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    const data = await res.json();
    console.log("✅ Produkte erhalten:", data.items?.length || 0);
    return data;
    
  } catch (error) {
    console.error("❌ Produktsuche fehlgeschlagen:", error);
    
    // Sofortiger Fallback
    const fallbackProducts = getStaticProducts(q, limit);
    return { 
      items: fallbackProducts, 
      totalCount: fallbackProducts.length 
    };
  }
}

// Statische Produkte als letzter Fallback
function getStaticProducts(query: string, limit: number): ShopifyProduct[] {
  const allProducts = [
    {
      id: "fallback-1",
      title: "FALLBACK: Basic T-Shirt",
      handle: "tshirt-basic-001",
      imageUrl: "https://picsum.photos/id/1011/300/300",
      imageAlt: "Basic T-Shirt",
      price: "19.90",
      compareAtPrice: "24.90",
      url: "https://avatarsalespro.myshopify.com/products/tshirt-basic-001",
      available: true
    },
    {
      id: "fallback-2",
      title: "FALLBACK: Premium T-Shirt",
      handle: "tshirt-premium-001", 
      imageUrl: "https://picsum.photos/id/1012/300/300",
      imageAlt: "Premium T-Shirt",
      price: "29.90",
      compareAtPrice: "39.90",
      url: "https://avatarsalespro.myshopify.com/products/tshirt-premium-001",
      available: true
    },
    {
      id: "fallback-3", 
      title: "FALLBACK: Classic Hoodie",
      handle: "hoodie-001",
      imageUrl: "https://picsum.photos/id/1013/300/300",
      imageAlt: "Classic Hoodie",
      price: "39.90",
      compareAtPrice: "49.90",
      url: "https://avatarsalespro.myshopify.com/products/hoodie-001",
      available: true
    }
  ];

  if (!query) return allProducts.slice(0, limit);
  
  return allProducts
    .filter(p => p.title.toLowerCase().includes(query.toLowerCase()))
    .slice(0, limit);
}