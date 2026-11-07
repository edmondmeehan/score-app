/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { bodySizeLimit: '8mb' } },
  images: { unoptimized: true },
};
export default nextConfig;
