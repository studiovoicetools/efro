import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET() {
  try {
    console.log("ğŸ” Teste Supabase Verbindung...");
    console.log("URL:", supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Einfache Abfrage testen
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(1);

    if (error) {
      console.error("âŒ Supabase Fehler:", error);
      return NextResponse.json({ 
        success: false, 
        error: error.message,
        details: "Verbindung fehlgeschlagen" 
      });
    }

    console.log("âœ… Supabase Verbindung erfolgreich!");
    console.log("Gefundene Produkte:", data?.length || 0);
    
    return NextResponse.json({ 
      success: true, 
      productsCount: data?.length || 0,
      sampleProduct: data?.[0] 
    });

  } catch (error: any) {
    console.error("âŒ Supabase Test fehlgeschlagen:", error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    });
  }
}

