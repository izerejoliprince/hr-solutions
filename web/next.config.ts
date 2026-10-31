import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiOrigin = process.env.API_REWRITE_DESTINATION?.replace(/\/+$/, "");
    if (!apiOrigin) return [];

    return [
      {
        source: "/api-backend/:path*",
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
