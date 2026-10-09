import { matchPath } from "@/i18n/routing";

/**
 * The page as a route template ("/projects/[slug]/tasks"), never the address: no query string, no hash, no project
 * slug, task or invitation id, and the same value in every language. Addresses that are not a known page collapse to
 * one placeholder.
 */
export function routeTemplate(pathname: string): string {
  return matchPath(pathname)?.route ?? "/not-found";
}

export type Landing = { referrerHost?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string };

const MAX_FIELD = 100;

/**
 * Where this page load came from, read once from the landing document: the referring page's host (never its address)
 * and the three campaign parameters. Held in memory only; nothing else of the address is read, so an invitation or
 * verification token in the query can never reach analytics.
 */
export function readLanding(): Landing {
  const landing: Landing = {};
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.host !== location.host) landing.referrerHost = referrer.hostname.slice(0, MAX_FIELD);
    }
  } catch {
    /* unreadable referrer: treated as none */
  }
  const params = new URLSearchParams(location.search);
  for (const [name, key] of [["utm_source", "utmSource"], ["utm_medium", "utmMedium"], ["utm_campaign", "utmCampaign"]] as const) {
    const value = params.get(name)?.trim();
    if (value) landing[key] = value.slice(0, MAX_FIELD);
  }
  return landing;
}
