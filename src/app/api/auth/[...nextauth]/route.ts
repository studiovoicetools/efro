// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { createClient } from "@supabase/supabase-js";
import { OAuthConfig } from "next-auth/providers";

// 🔹 Verbindung zu Supabase mit Service Key (Schreibrechte)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 🔹 Manuelle Definition des Shopify-OAuth-Providers
const ShopifyProvider: OAuthConfig<any> = {
  id: "shopify",
  name: "Shopify",
  type: "oauth",
  authorization: {
    url: "https://accounts.shopify.com/oauth/authorize",
    params: {
      scope:
        "read_products,write_products,read_script_tags,write_script_tags,read_customers,write_customers",
    },
  },
  token: "https://accounts.shopify.com/oauth/token",
  userinfo: {
    url: "https://api.shopify.com/v1/shop.json",
    async request({ tokens }) {
      const res = await fetch("https://api.shopify.com/v1/shop.json", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const data = await res.json();
      return data.shop;
    },
  },
  clientId: process.env.SHOPIFY_API_KEY!,
  clientSecret: process.env.SHOPIFY_API_SECRET!,
  profile(profile) {
    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      shop: profile.myshopify_domain || profile.domain,
    };
  },
};

// 🔹 NextAuth-Handler
const handler = NextAuth({
  providers: [ShopifyProvider],

  callbacks: {
    async signIn({ account, profile }) {
      const shopDomain =
        (profile as any)?.shop ||
        (profile as any)?.myshopify_domain ||
        (account as any)?.shop_domain;
      const accessToken = (account as any)?.access_token || "";

      console.log("🟠 Shopify Callback erhalten:");
      console.log("   ➤ Shop:", shopDomain);
      console.log("   ➤ Access Token:", accessToken ? "[vorhanden]" : "❌ leer");

      if (!shopDomain || !accessToken) {
        console.error("❌ Shopify-Auth: unvollständige Daten");
        return false;
      }

      try {
        const plan = "basic"; // später dynamisch aus URL

        console.log(`💾 Supabase-Upsert für ${shopDomain}, Plan: ${plan}`);

        const { data, error } = await supabase
          .from("shops")
          .upsert(
            {
              shop: shopDomain,
              access_token: accessToken,
              plan,
              active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "shop" }
          )
          .select();

        if (error) {
          console.error("❌ Supabase Insert-Fehler:", error);
        } else {
          console.log("✅ Supabase Eintrag erfolgreich:", data);
        }
      } catch (err) {
        console.error("❌ Fehler beim Speichern in Supabase:", err);
      }

      return true;
    },
  },

  secret: process.env.NEXTAUTH_SECRET!,
  session: { strategy: "jwt" },
});

export { handler as GET, handler as POST };
