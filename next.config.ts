import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Cloudflare Pages doesn't support dynamic routes with export
  trailingSlash: true,
};

export default nextConfig;
