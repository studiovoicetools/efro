/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopify.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.elevenlabs.io" }
    ]
  },
  output: "standalone",
  // Exclude problematic routes from static generation during build
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        'src/app/admin/billing/**',
        'src/app/admin/import/**',
        'src/app/api/checkout/url/**',
        'src/app/api/demo-products/**'
      ]
    }
  }
};

module.exports = nextConfig;
