import type { MetadataRoute } from "next";

/** Only the public auth screens are crawlable; everything behind login is opted out per-page too. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/login", "/register", "/forgot-password"], disallow: "/" },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
