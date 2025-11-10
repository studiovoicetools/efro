import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * ğŸ”¹ Ziel:
 * LÃ¤dt Demo-Produkte aus Supabase (products_demo)
 * und Ã¼bertrÃ¤gt sie in Shopify mit Tag "efro-demo"
 * â†’ ideal fÃ¼r Showcase & Tests auf der Wix-Startseite
 */

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SHOPIFY_ADMIN_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN!;
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    // ğŸ”¸ Verbindung zu Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // ğŸ”¸ Alle Demo-Produkte holen
    const { data: demoProducts, error } = await supabase
      .from("products_demo")
      .select("*")
      .limit(20);

    if (error) throw error;
    if (!demoProducts?.length)
      return NextResponse.json({
        success: false,
        message: "Keine Demo-Produkte in Supabase gefunden.",
      });

    let uploaded = 0;
    const results: any[] = [];

    // ğŸ”¸ Jedes Produkt zu Shopify hochladen
    for (const p of demoProducts) {
      const mutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id title handle }
            userErrors { field message }
          }
        }
      `;

      const variables = {
        input: {
          title: p.title || "Unbenanntes Produkt",
          descriptionHtml: p.description || "",
          vendor: p.vendor || "EFRO Demo",
          handle:
            p.handle ||
            (p.title || "demo")
              .toLowerCase()
              .replace(/[^a-z0-9-]/g, "-")
              .slice(0, 50),
          tags: ["efro-demo", p.category],
          variants: [
            {
              price: p.price?.toString() || "0.00",
              sku: p.sku || `DEMO-${Math.floor(Math.random() * 10000)}`,
            },
          ],
          images: p.featuredImage ? [{ src: p.featuredImage }] : [],
        },
      };

      const res = await fetch(
        `https://${SHOPIFY_ADMIN_DOMAIN}/admin/api/2025-10/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
          },
          body: JSON.stringify({ query: mutation, variables }),
        }
      );

      const json = await res.json();
      const errMsg = json?.data?.productCreate?.userErrors?.[0]?.message;

      if (!errMsg) {
        uploaded++;
        results.push({
          title: p.title,
          handle: variables.input.handle,
          status: "âœ… Erfolgreich hochgeladen",
        });
      } else {
        results.push({
          title: p.title,
          error: errMsg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      total: demoProducts.length,
      results,
    });
  } catch (err: any) {
    console.error("âŒ Demo Upload Error:", err.message);
    return NextResponse.json({ success: false, error: err.message });
  }
}
