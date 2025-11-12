// next.config.js
import path, { dirname } from "path";
import { fileURLToPath } from "url";

// ✅ __dirname-Fix für ES-Module (Render benötigt das!)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Strikter React-Modus für saubere Renderings
  reactStrictMode: true,

  // ✅ Standalone-Output für Render Deployment
  output: "standalone",

  // ✅ Build-Time ENV (Frontend-sicher, ohne Secrets)
  env: {
    SHOPIFY_STORE_DOMAIN:
      process.env.SHOPIFY_STORE_DOMAIN || "avatarsalespro-dev.myshopify.com",
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || "10",
    NEXT_PUBLIC_BASE_URL:
      process.env.NEXT_PUBLIC_BASE_URL ||
      "https://efro-prod.onrender.com",
  },

  // ✅ Erlaubte Remote-Image-Hosts (Shopify, Supabase, ElevenLabs, Mascot)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.elevenlabs.io" },
      { protocol: "https", hostname: "*.mascotbot.com" },
      { protocol: "https", hostname: "*.mascot.bot" },
    ],
  },

  // ✅ Header-Regeln (Cache-Control)
  async headers() {
    return [
      // Cache für statische Assets (1 Jahr)
      {
        source:
          "/:all*(riv|svg|png|jpg|jpeg|gif|webp|mp4|mp3|woff2|woff|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Kein Cache für API-Endpunkte (immer live)
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  // ✅ Webpack-Aliase (Render- und Dev-kompatibel)
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    config.resolve.alias["@components"] = path.resolve(
      __dirname,
      "src/components"
    );
    config.resolve.alias["@hooks"] = path.resolve(__dirname, "src/hooks");
    config.resolve.alias["@utils"] = path.resolve(__dirname, "src/utils");
    config.resolve.alias["@lib"] = path.resolve(__dirname, "src/lib");
    config.resolve.alias["@assets"] = path.resolve(__dirname, "public/assets");
    return config;
  },

  // ✅ Performance/Cache-Empfehlungen
  experimental: {
    optimizeCss: true,
    typedRoutes: true,
  },

  // ✅ Ignoriere unnötige ESLint/TypeScript Warnungen im Build
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
