export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// src/app/api/billing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/**
 * Diese Route erzeugt Shopify-Billing-Links und aktualisiert Supabase:
 *  - Basic / Pro → einmalige App-Käufe
 *  - Enterprise → wiederkehrendes Abo
 *
 * Nach erfolgreicher Erstellung wird in Supabase gespeichert:
 *   → plan, active, updated_at
 */

export const runtime = "nodejs";

const ADMIN_VERSION = "2024-07";
type Plan = "basic" | "pro" | "enterprise";

const PRICES: Record<Plan, { amount: number; currency: "EUR"; recurring?: boolean }> = {
  basic: { amount: 299.0, currency: "EUR" },
  pro: { amount: 699.0, currency: "EUR" },
  enterprise: { amount: 999.0, currency: "EUR", recurring: true },
};

/** 🔐 Sichere Shopify GraphQL Helper-Funktion **/
async function adminGraphQL<T>(
  shop: string,
  accessToken: string,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const url = `https://${shop}/admin/api/${ADMIN_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const text = await res.text();

  if (!res.ok) {
    console.error("❌ Shopify HTTP Error:", res.status, text);
    throw new Error(`Shopify HTTP ${res.status}: ${text}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("❌ JSON-Parsing-Fehler:", err, "\nAntwort:", text);
    throw new Error("Fehler beim Parsen der Shopify-Antwort");
  }
}

/** 🚀 Billing-Hauptlogik **/
export async function POST(request: NextRequest) {
  try {
    // 🧩 Lazy Supabase-Initialisierung — erst zur Laufzeit
    const supabaseUrl =
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error("❌ Supabase-Umgebungsvariablen fehlen!");
      return NextResponse.json(
        { error: "Supabase environment variables missing." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // DEV-BYPASS
    if (process.env.BILLING_DISABLED === "true") {
      console.log("⚠️ Billing deaktiviert (DEV-Modus)");
      return NextResponse.json({
        success: true,
        confirmationUrl: "https://dev.local/billing/test-confirmation",
        plan: "dev",
        test: true,
      });
    }

    const body = await request.json();
    const { shop, plan, returnUrl } = body as {
      shop: string;
      plan: Plan;
      returnUrl?: string;
    };

    if (!shop || !plan) {
      return NextResponse.json(
        { error: "Parameter 'shop' und 'plan' sind erforderlich." },
        { status: 400 }
      );
    }

    if (
      !/^.+\.myshopify\.com$/i.test(shop) &&
      !/^admin\.shopify\.com\/store\//i.test(shop)
    ) {
      return NextResponse.json(
        { error: "Ungültige Shop-Domain" },
        { status: 400 }
      );
    }

    const cfg = PRICES[plan];
    if (!cfg) {
      return NextResponse.json({ error: "Unbekannter Plan" }, { status: 400 });
    }

    // 🔑 Access Token abrufen (aus Supabase oder Env)
    let accessToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || "";
    const { data: shopRow } = await supabase
      .from("shops")
      .select("*")
      .eq("shop", shop)
      .single();
    if (shopRow?.access_token) accessToken = shopRow.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Kein Admin-Access-Token verfügbar" },
        { status: 500 }
      );
    }

    const safeReturnUrl =
      returnUrl ||
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/admin/billing`
        : "https://admin.shopify.com");

    /** 💎 Enterprise-Plan (monatlich wiederkehrend) **/
    if (plan === "enterprise") {
      const MUTATION = `
        mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean, $lineItems: [AppSubscriptionLineItemInput!]!) {
          appSubscriptionCreate(name: $name, returnUrl: $returnUrl, test: $test, lineItems: $lineItems) {
            userErrors { field message }
            confirmationUrl
            appSubscription { id name status }
          }
        }
      `;

      const variables = {
        name: "EFRO Enterprise",
        returnUrl: safeReturnUrl,
        test: process.env.SHOPIFY_BILLING_TEST === "true",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: cfg.amount, currencyCode: cfg.currency },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
      };

      const result = await adminGraphQL<any>(shop, accessToken, MUTATION, variables);
      const errors = result?.data?.appSubscriptionCreate?.userErrors;
      const confirmationUrl = result?.data?.appSubscriptionCreate?.confirmationUrl;

      if (errors?.length) {
        return NextResponse.json(
          { error: "Billing-Fehler", details: errors },
          { status: 400 }
        );
      }

      await supabase
        .from("shops")
        .update({
          plan: "enterprise",
          active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("shop", shop);

      return NextResponse.json({ success: true, confirmationUrl, plan });
    }

    /** 💳 Basic / Pro Einmalzahlung **/
    const ONE_TIME = `
      mutation appPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
        appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
          userErrors { field message }
          confirmationUrl
          appPurchaseOneTime { id }
        }
      }
    `;

    const variables = {
      name: plan === "pro" ? "EFRO Pro" : "EFRO Basic",
      price: { amount: cfg.amount, currencyCode: cfg.currency },
      returnUrl: safeReturnUrl,
      test: process.env.SHOPIFY_BILLING_TEST === "true",
    };

    const result = await adminGraphQL<any>(shop, accessToken, ONE_TIME, variables);
    const errors = result?.data?.appPurchaseOneTimeCreate?.userErrors;
    const confirmationUrl = result?.data?.appPurchaseOneTimeCreate?.confirmationUrl;

    if (errors?.length) {
      return NextResponse.json(
        { error: "Billing-Fehler", details: errors },
        { status: 400 }
      );
    }

    await supabase
      .from("shops")
      .update({
        plan,
        active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("shop", shop);

    return NextResponse.json({ success: true, confirmationUrl, plan });
  } catch (error) {
    console.error("❌ Billing API error:", error);
    return NextResponse.json(
      { error: "Billing processing failed" },
      { status: 500 }
    );
  }
}

