import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'bcryptjs', 'nodemailer'],
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: '26mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
        ],
      },
      { source: '/admin/:path*', headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
      ] },
      { source: '/api/admin/:path*', headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
      ] },
    ];
  },
};

export default nextConfig;
