import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/tally/:path*',
        destination: 'http://127.0.0.1:3000/api/tally/:path*',
      },
      {
        source: '/api/products',
        destination: 'http://127.0.0.1:8000/api/inventory',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
