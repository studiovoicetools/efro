import path, { dirname } from "path";
import { fileURLToPath } from "url";

// 🔹 __dirname-Fix für ES-Module (Render benötigt das!)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 🔹 Render-kompatibles Standalone-Build
  output: "standalone",

  // 🔹 Build-Time Env-Variablen (Frontend-safe)
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || "10",
  },

  // 🔹 Remote-Bilder (optional)
  images: {
    remotePatterns: [
      // { protocol: "https", hostname: "**.cdn.shopify.com" },
    ],
  },

  // 🔹 Cache-Header für Assets & API
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

  // 🔹 Webpack-Aliase (funktioniert auch auf Render)
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
