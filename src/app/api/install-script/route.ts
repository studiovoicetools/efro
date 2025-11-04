// ERSTELLE DIESE DATEI: app/api/install-script/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { shopDomain } = await request.json();
    
    // Hier würdest du in einer echten App den Script-Tag in Shopify installieren
    // Für jetzt simulieren wir das erstmal
    console.log(`🛠️ Installiere Avatar für Shop: ${shopDomain}`);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Avatar erfolgreich installiert',
      scriptTag: {
        id: 'avatar-sales-pro-script',
        src: `${process.env.NEXTAUTH_URL}/avatar-loader.js`,
        shop: shopDomain
      }
    });
  } catch (error) {
    console.error('Installation fehlgeschlagen:', error);
    return NextResponse.json({ error: 'Installation fehlgeschlagen' }, { status: 500 });
  }
}