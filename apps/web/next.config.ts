import type { NextConfig } from "next";
import path from "path";
import fs from "fs";

function getTurbopackRoot(): string {
  if (process.env.TURBOPACK_ROOT) {
    return process.env.TURBOPACK_ROOT;
  }
  const monorepoRoot = path.resolve(__dirname, "../../");
  if (fs.existsSync(path.join(monorepoRoot, "apps")) || fs.existsSync(path.join(monorepoRoot, "package.json"))) {
    return monorepoRoot;
  }
  return path.resolve(__dirname);
}

/**
 * Production config for Contabo VPS with Node.js (next start).
 * Image Optimization runs server-side: resizes, converts to WebP/AVIF, generates srcset.
 * For static export only, set output: "export" and images.unoptimized: true (images served raw).
 */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
// output: 'standalone',           // enables minimal Docker production image
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '5001',
        pathname: '/uploads/**',
      },
      // Keep your production domain ready for later
      {
        protocol: 'https',
        hostname: 'api.f2hfresh.com', // change this to your actual production backend URL
        pathname: '/uploads/**',
      },
    ],
  },
  turbopack: {
    root: getTurbopackRoot(),
  },
  experimental: {
    optimizePackageImports: ["react-icons", "lucide-react"],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:5001/uploads/:path*',
      },
    ];
  },
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
