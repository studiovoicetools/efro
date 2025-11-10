// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Wichtig für Render: erzeugt ein selbstenthaltendes Build-Artefakt
  output: 'standalone',

  // 🔹 Environment Variables für Shopify (werden zur Buildzeit ins Frontend injiziert – nur Unkritisches hier)
  //   Kritische Keys (Admin, Server Keys) NUR serverseitig verwenden (Route-Handler),
  //   nicht unter NEXT_PUBLIC_* weiterreichen.
  env: {
    SHOPIFY_STORE_DOMAIN: process.env.SHOPIFY_STORE_DOMAIN,
    SHOPIFY_MAX_RESULTS: process.env.SHOPIFY_MAX_RESULTS || '10',
  },

  // Optional – falls du externe Bilder/Assets nutzt, kann das ergänzt werden
  images: {
    remotePatterns: [
      // { protocol: 'https', hostname: '**.cdn.shopify.com' },
    ],
  },

  // 🔹 HTTP-Header für statische Assets:
  // Lange Caches für unveränderliche Dateien (Rive, SVG, Bilder, Fonts, Media),
  // KEIN Cache für dynamische API/SSR.
  async headers() {
    return [
      // Lange Cachezeit für statische, versionsgebundene Assets
      {
        source: '/:all*(riv|svg|png|jpg|jpeg|gif|webp|mp4|mp3|woff2|woff|ttf|otf)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Beispiel für APIs/SSR ohne Cache (nur wenn nötig – API-Routen haben ohnehin meist no-store Semantik)
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
    ];
  },
};

export default nextConfig;
