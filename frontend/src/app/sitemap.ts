import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { buildPath, type PageRoute } from "@/i18n/routing";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const pages: { route: PageRoute; priority: number }[] = [
    { route: "/", priority: 1 },
    { route: "/login", priority: 0.7 },
    { route: "/register", priority: 0.8 },
    { route: "/faq", priority: 0.6 },
    { route: "/accessibility", priority: 0.4 },
    { route: "/license", priority: 0.3 },
  ];
  return pages.flatMap(({ route, priority }) => locales.map((locale) => ({
    url: `${base}${buildPath(route, {}, locale)}`,
    alternates: { languages: Object.fromEntries(locales.map((language) => [language, `${base}${buildPath(route, {}, language)}`])) },
    changeFrequency: "monthly" as const,
    priority,
  })));
}
