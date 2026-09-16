import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/invoices/[id]/pdf': [
      './node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff2',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
