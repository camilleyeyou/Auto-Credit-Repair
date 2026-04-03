import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy /api/backend/* requests to FastAPI backend in production.
  // This avoids browser CORS issues on Vercel preview deploys where
  // the FastAPI URL may differ from the configured FRONTEND_URL on Railway.
  async rewrites() {
    const fastapiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/backend/:path*",
        destination: `${fastapiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
