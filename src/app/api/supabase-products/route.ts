import { NextResponse } from "next/server";
import { jsonUtf8 } from "@/lib/http/jsonUtf8";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("products")
      .select("*");

    if (error) throw error;

    return jsonUtf8({
      success: true,
      count: data.length,
      products: data
    });
  } catch (err: any) {
    return jsonUtf8(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
