import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Build number = UTC build time (YYMMDD.HHMM), e.g. 261107.1835. Stamped once per deploy.
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const build = `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}.${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;

/** @type {import('next').NextConfig} */
// Security headers on every response. The CSP is deliberately limited to what can't break the app or its partners
// (no framing by other sites, no plugins, no <base> hijacking); scripts and connections stay unrestricted for now.
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests" },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_NUMBER: build,
    NEXT_PUBLIC_DEPLOY_ID: (process.env.VERCEL_DEPLOYMENT_ID || '').replace(/^dpl_/, '').slice(0, 7),
  },
};
export default nextConfig;
