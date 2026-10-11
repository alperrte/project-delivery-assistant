import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { buildPath, type PageRoute } from "@/i18n/routing";

/** Public content is crawlable. Workspace, API and preview paths stay excluded. `/_next/` is deliberately not blocked: crawlers must fetch the page scripts and styles to render the page. */
export default function robots(): MetadataRoute.Robots {
  const privateRoutes: PageRoute[] = ["/dashboard", "/projects", "/organizations", "/account", "/settings", "/calendar", "/tasks", "/invitations", "/admin", "/change-password", "/errors/[code]", "/dev/error-test"];
  const disallow = ["/api/", ...locales.flatMap((locale) => privateRoutes.map((route) =>
    route === "/errors/[code]" ? buildPath(route, { code: "placeholder" }, locale).replace("placeholder", "") : buildPath(route, {}, locale)))];
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
