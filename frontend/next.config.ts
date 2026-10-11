import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Baseline response headers for every page. The Content-Security-Policy is NOT set here: it carries a per-request nonce
// and is built in the proxy (src/proxy.ts, src/lib/security/csp.ts).
// HSTS is sent by production builds only; browsers ignore it on plain http, so it is harmless behind a TLS-terminating
// proxy and never pins http://localhost during development. `preload` is deliberately left out (a hard-to-undo commitment).
const hsts = process.env.NODE_ENV === "production"
  ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
  : [];
const securityHeaders = [
  ...hsts,
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
  // No `X-Powered-By: Next.js` header: it tells a scanner which framework to attack and serves no purpose.
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker file must never be served from a cache, or an update would not reach returning visitors. The
      // narrow policy applies to the worker script itself (the pages it controls get their policy from the proxy).
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
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

// `npm run analyze` (webpack build + treemap report) loads the analyzer. It is a devDependency: the production image installs
// without devDependencies, so it must never be imported on a normal start (a static import crashed the container).
export default async function config() {
  const withIntl = withNextIntl(nextConfig);
  if (process.env.ANALYZE !== "1") return withIntl;
  const { default: createBundleAnalyzer } = await import("@next/bundle-analyzer");
  return createBundleAnalyzer({ enabled: true })(withIntl);
}
