// app/api/shopify-products/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || '';

    const url = `https://${storeDomain}/admin/api/2024-01/products.json`;
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken!,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Shopify API Response Status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Shopify API Error:', errorText);
      return NextResponse.json(
        { error: `Shopify API failed: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Shopify Products Found:', data.products?.length || 0);

    // Einfache Filterung
    let products = data.products || [];
    
    if (category) {
      const searchTerm = category.toLowerCase();
      products = products.filter((product: any) => {
        const titleMatch = product.title?.toLowerCase().includes(searchTerm);
        const tagsMatch = product.tags?.toLowerCase().includes(searchTerm);
        const typeMatch = product.product_type?.toLowerCase().includes(searchTerm);
        
        return titleMatch || tagsMatch || typeMatch;
      });
    }

    // Transformiere für den Avatar
    const formattedProducts = products.map((product: any) => ({
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      imageUrl: product.image?.src || product.images?.[0]?.src || null,
      imageAlt: product.image?.alt || product.title,
      price: product.variants?.[0]?.price || '0.00',
      compareAtPrice: product.variants?.[0]?.compare_at_price || null,
      url: `https://${storeDomain}/products/${product.handle}`,
      available: product.status === 'active',
      category: product.product_type || 'general',
      tags: product.tags || ''
    }));

    return NextResponse.json({ 
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });

  } catch (error) {
    console.error('❌ Shopify Connection Failed:', error);
    return NextResponse.json(
      { error: 'Connection failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}