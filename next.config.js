// next.config.js (ESM, ohne optimizeCss)

import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone fuer Render
  output: "standalone",

  // Build Time Env Variablen
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || "10",
  },

  // WICHTIG: keine experimental.optimizeCss mehr
  // Wenn du typedRoutes wirklich brauchst:
  // experimental: {
  //   typedRoutes: true,
  // },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.elevenlabs.io" },
    ],
  },

  async headers() {
    return [
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
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },

  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname, "src");
    config.resolve.alias["@components"] = path.resolve(
      __dirname,
      "src/components"
    );
    config.resolve.alias["@hooks"] = path.resolve(__dirname, "src/hooks");
    config.resolve.alias["@utils"] = path.resolve(__dirname, "src/utils");
    config.resolve.alias["@lib"] = path.resolve(__dirname, "src/lib");
    return config;
  },
};

export default nextConfig;
