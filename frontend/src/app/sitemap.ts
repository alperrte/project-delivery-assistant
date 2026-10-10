import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { buildPath, type PageRoute } from "@/i18n/routing";
import { languageAlternates } from "@/lib/seo/alternates";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages: { route: PageRoute; priority: number }[] = [
    { route: "/", priority: 1 },
    { route: "/login", priority: 0.7 },
    { route: "/register", priority: 0.8 },
    { route: "/about", priority: 0.5 },
    { route: "/faq", priority: 0.6 },
    { route: "/contact", priority: 0.5 },
    { route: "/kvkk", priority: 0.4 },
    { route: "/privacy", priority: 0.4 },
    { route: "/terms", priority: 0.4 },
    { route: "/cookies", priority: 0.4 },
    { route: "/accessibility", priority: 0.4 },
    { route: "/license", priority: 0.3 },
  ];
  return pages.flatMap(({ route, priority }) => locales.map((locale) => ({
    url: `${base}${buildPath(route, {}, locale)}`,
    alternates: { languages: languageAlternates(route, base) },
    changeFrequency: "monthly" as const,
    priority,
  })));
}
