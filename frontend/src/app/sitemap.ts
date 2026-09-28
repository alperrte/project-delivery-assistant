import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return [
    { url: `${base}/login`, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/register`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
