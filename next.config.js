// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ⛔️ WICHTIG: Verhindert, dass Render statisch prerendert
  output: "standalone",
  generateStaticParams: async () => [],

  // 🩵 Ergänzung: Render darf keine statischen Seiten generieren
  trailingSlash: false,
  compress: true,

  experimental: {},

  // 🔹 Environment Variables für Shopify
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || "10",
  },

  // 🔹 Webpack Config für Pfadauflösung
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },

  // 🔹 Keine aggressive Browser-Caches für statische Dateien
  async headers() {
    return [
      {
        source: "/:all*(riv|svg|mp3|mp4|png|jpg|jpeg|gif|webp)",
        headers: [
          {
            key: "Cache-Control",
            value:
              "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
