import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Cloudflare Pages doesn't support dynamic routes with export
  trailingSlash: true,
};

export default nextConfig;
