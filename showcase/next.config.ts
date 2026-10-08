import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export", poweredByHeader: false, trailingSlash: true,
  // Bound local build concurrency on machines also running the reference stack.
  experimental: { cpus: 2, webpackMemoryOptimizations: true },
};
export default config;
