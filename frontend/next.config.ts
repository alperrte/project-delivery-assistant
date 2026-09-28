import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // 75 is the default; 95 keeps the full-screen auth backgrounds sharp.
    qualities: [75, 95],
  },
};

export default withNextIntl(nextConfig);
