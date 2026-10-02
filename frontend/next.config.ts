import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Baseline response headers for every page. A Content-Security-Policy is deliberately not set here: Next.js
// needs a per-request nonce for its inline scripts, which belongs in the proxy and is tracked as a follow-up.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // 75 is the default; 95 keeps the full-screen auth backgrounds sharp.
    qualities: [75, 95],
  },
};

export default withNextIntl(nextConfig);
