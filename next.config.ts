import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: Object.entries(securityHeaders).map(([key, value]) => ({ key, value })) }];
  },
  // Two MiB image limit plus multipart overhead; application validation is stricter.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
};
export default nextConfig;
