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
  // This prevents Next.js from trying to analyze/export API routes and legacy admin pages
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        // Exclude all API routes (they are server-side only)
        'src/app/api/**',
        // Exclude problematic admin routes that cause build errors
        'src/app/admin/billing/**',
        'src/app/admin/import/**'
      ]
    }
  }
};

module.exports = nextConfig;
