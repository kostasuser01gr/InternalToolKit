import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@internal-toolkit/shared"],
};

export default nextConfig;
