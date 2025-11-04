// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 🔹 App Router ist in Next.js 14 standardmäßig aktiviert
  experimental: {
    // Keine experimental Flags mehr nötig für App Router
  },

  // 🔹 Environment Variables für Shopify
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_ADMIN_ACCESS_TOKEN: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || '10',
  },

  // 🔹 Webpack Config für bessere Pfadauflösung
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },

  // 🔹 Cache für statische Dateien
  async headers() {
    return [
      {
        source: "/:all*(riv|svg|mp3|mp4|png|jpg|jpeg|gif|webp)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;