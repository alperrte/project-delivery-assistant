import type { MetadataRoute } from "next";

/** Public content is crawlable. Workspace, API and preview paths stay excluded. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/projects", "/organizations", "/account", "/calendar", "/tasks", "/invitations", "/change-password", "/errors/", "/dev/"] },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/sitemap.xml`,
  };
}
