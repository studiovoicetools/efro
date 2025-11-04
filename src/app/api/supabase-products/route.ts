// app/api/supabase-products/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Supabase Client erstellen
    const supabase = createClient();

    // Produkte aus Supabase abrufen
    let query = supabase.from('products').select('*');

    // Nach Kategorie filtern, falls angegeben
    if (category) {
      query = query.ilike('category', `%${category}%`);
    }

    const { data: products, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ products: products || [] });
  } catch (error) {
    console.error('Supabase Products Error:', error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}