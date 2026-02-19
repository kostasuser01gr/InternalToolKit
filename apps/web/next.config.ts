import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@internal-toolkit/shared"],
  outputFileTracingIncludes: {
    "/*": ["./prisma/runtime.sqlite"],
  },
};

export default nextConfig;
