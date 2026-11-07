import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Build number = UTC build time (YYMMDD.HHMM), e.g. 261107.1835. Stamped once per deploy.
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
const build = `${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}.${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_BUILD_NUMBER: build,
    NEXT_PUBLIC_DEPLOY_ID: (process.env.VERCEL_DEPLOYMENT_ID || '').replace(/^dpl_/, '').slice(0, 7),
  },
};
export default nextConfig;
