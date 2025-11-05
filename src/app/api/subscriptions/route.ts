import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// ğŸ”¥ AKTUALISIERTE Abo-Features - JETZT MIT SPRACHSTEUERUNG FÃœR ALLE
const tierFeatures = {
  basic: {
    maxProducts: 10,
    hasVoiceRecognition: true,  // âœ… GEÃ„NDERT: Jetzt true fÃ¼r Basic
    hasCrossSelling: false,
    hasAnalytics: false,
    multilingual: false,
    price: 299
  },
  pro: {
    maxProducts: 50,
    hasVoiceRecognition: true,
    hasCrossSelling: true,
    hasAnalytics: false,
    multilingual: true,
    price: 699
  },
  enterprise: {
    maxProducts: 9999,
    hasVoiceRecognition: true,
    hasCrossSelling: true,
    hasAnalytics: true,
    multilingual: true,
    price: 999
  }
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = searchParams.get('shop');

    if (!shop) {
      return NextResponse.json(
        { error: "Shop parameter is required" },
        { status: 400 }
      );
    }

    console.log("ğŸ” Checking subscription for shop:", shop);

    // Demo: Immer Basic zurÃ¼ckgeben fÃ¼r Tests
    const shopConfig = {
      id: 'demo-shop',
      domain: shop,
      name: shop.replace('.myshopify.com', ''),
      subscription: 'basic' as const,
      features: tierFeatures.basic,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    console.log("âœ… Shop config:", shopConfig);
    return NextResponse.json(shopConfig);

  } catch (error) {
    console.error("âŒ Subscription API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

