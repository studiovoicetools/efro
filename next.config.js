import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 🔹 Für Render: erzeugt eigenständiges Build
  output: "standalone",

  // 🔹 Build-time Environment-Variablen (nur unkritische!)
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || "10",
  },

  images: {
    remotePatterns: [
      // { protocol: "https", hostname: "**.cdn.shopify.com" },
    ],
  },

  // 🔹 Cache-Header für statische Assets & API
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

  // ✅ Alias-Fix für Render-Webpack
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
