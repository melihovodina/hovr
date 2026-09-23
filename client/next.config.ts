import type { NextConfig } from "next";

// The Go server serves the export in production; in dev, /api is proxied to it.
const API_ORIGIN = process.env.HOVR_API_ORIGIN ?? "http://localhost:8080";
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // The dev badge would sit on top of the widget's launcher inside the embed iframe.
  devIndicators: false,
  ...(isDev && {
    async rewrites() {
      return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
    },
  }),
};

export default nextConfig;
