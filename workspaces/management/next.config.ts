import type { NextConfig } from "next";

const backendBase = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  reactStrictMode: false,

  async rewrites() {
    return [
      {
        source: '/api/products',
        destination: `${backendBase}/api/inventory`,
      },
      {
        source: '/api/:path*',
        destination: `${backendBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
