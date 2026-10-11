import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import createBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// `npm run analyze` (webpack build + treemap report). Off in every normal build. The Turbopack build has its own viewer:
// `npx next experimental-analyze`.
const withBundleAnalyzer = createBundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

// Baseline response headers for every page. A Content-Security-Policy is deliberately not set here: Next.js
// needs a per-request nonce for its inline scripts, which belongs in the proxy and is tracked as a follow-up.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Cache policy of the static files in `public/` (see .agents/architecture.md "Caching"). `/_next/static/*` is content-hashed and
// already served `immutable` by Next. The files below keep a stable URL, so they are NOT immutable: a day in every cache, and a
// week during which a stale copy may be served while it is revalidated in the background. Replace a file under a new name
// when it must change at once.
const publicAssetCache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];

const nextConfig: NextConfig = {
  // Production source maps are never shipped to browsers: they would expose the original source and comments to anyone.
  // (This is also Next's default; it is spelled out so a later change is a visible decision.)
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/images/:path*", headers: publicAssetCache },
      { source: "/icons/:path*", headers: publicAssetCache },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // 75 is the default; 95 keeps the full-screen auth backgrounds sharp.
    qualities: [75, 95],
    // Optimised images are re-encoded once per width and format; keep them for a month instead of Next's 60 s default.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Only the widths the site renders: the 1672 px auth background is the widest source, so nothing above 1672 is ever useful.
    deviceSizes: [640, 828, 1200, 1672],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
