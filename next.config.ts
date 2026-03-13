import type { NextConfig } from "next";

// 检测构建环境是否是vercel
const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 若构建环境为 vercel, 则使用 4 workers 进行构建
  experimental: isVercel ? {
    cpus: 4
  } : undefined,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "raw.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "mc-heads.net",
      },
    ],
  },
};

export default nextConfig;
