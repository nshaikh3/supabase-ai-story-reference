import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Two MiB image limit plus multipart overhead; application validation is stricter.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
export default nextConfig;
