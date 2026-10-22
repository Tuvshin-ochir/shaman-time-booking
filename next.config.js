/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // `npm run test:e2e` builds into its own folder so it never disturbs a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  agentRules: false,
  turbopack: { root: import.meta.dirname },
  // The site looks the same in development as in production.
  devIndicators: false,
  // News pictures are sent with the news form (resized in the browser first).
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  async headers() {
    // Photos in public/ never change in place, so browsers can keep them a week.
    return [{ source: '/img/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }] }];
  },
};

export default nextConfig;
