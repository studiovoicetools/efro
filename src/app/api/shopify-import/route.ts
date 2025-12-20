import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST() {
  try {
    /* --------------------
       Supabase Setup
    -------------------- */
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials (URL or SERVICE_ROLE_KEY)");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: sbProducts, error: sbError } = await supabase
      .from("products_demo")
      .select("*");

    if (sbError) throw sbError;

    /* --------------------
       Shopify Setup
    -------------------- */
    const store = process.env.SHOPIFY_STORE_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

    if (!store || !token) {
      throw new Error("Shopify credentials missing");
    }

    const shopifyUrl = `https://${store}/admin/api/2024-01/products.json`;

    let imported = 0;
    const errors: any[] = [];

    /* --------------------
       LOOP: Produkte importieren
    -------------------- */
    for (const p of sbProducts) {
      const body = {
        product: {
          title: p.title,
          body_html: p.description || "",
          vendor: p.vendor || "EFRO Demo",
          product_type: p.category || "Demo",
          tags: p.tags || [],

          variants: [
            {
              price: p.price?.toString() || "0.00",
            },
          ],

          images: p.image_url ? [{ src: p.image_url }] : [],
        },
      };

      const res = await fetch(shopifyUrl, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      // Shopify Antwort prüfen
      if (json.product) {
        imported++;
      } else {
        errors.push({
          product: p.title,
          shopifyResponse: json,
        });
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      errors,
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
