import type { NextConfig } from "next";

const BACKEND_URL =
  process.env.BACKEND_API_URL ||
  "https://business-ops-platform-api.onrender.com";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
