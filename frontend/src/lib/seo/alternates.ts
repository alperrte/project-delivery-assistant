import { buildPath, type PageRoute } from "@/i18n/routing";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

/** Share preview: 1200x630 is the size link previews are drawn at; the square logo is cropped there. */
export const OG_IMAGE = { url: "/images/branding/og-image.png", width: 1200, height: 630, type: "image/png", alt: "PDA · Project Delivery Assistant" };

const SITE_NAME = "PDA · Project Delivery Assistant";

const OG_LOCALES: Record<Locale, string> = { tr: "tr_TR", en: "en_US", de: "de_DE" };

/** Every language version of a page plus `x-default`, the version a visitor with an unlisted language gets. Paths are prefixed with `base` when given (the sitemap needs absolute URLs). */
export function languageAlternates(route: PageRoute, base = "") {
  return {
    ...Object.fromEntries(locales.map((language) => [language, `${base}${buildPath(route, {}, language)}`])),
    "x-default": `${base}${buildPath(route, {}, defaultLocale)}`,
  };
}

/** Canonical URL and language versions of a public page. */
export function pageAlternates(route: PageRoute, locale: Locale) {
  return { canonical: buildPath(route, {}, locale), languages: languageAlternates(route) };
}

/**
 * The full share block of a public page. A page that sets `openGraph` replaces the layout's block instead of merging
 * with it, so every field a share preview needs is repeated here. Title and description come from the page itself.
 */
export function pageOpenGraph(route: PageRoute, locale: Locale) {
  return { type: "website" as const, siteName: SITE_NAME, url: buildPath(route, {}, locale), images: [OG_IMAGE], ...openGraphLocale(locale) };
}

/** `og:locale` is the page language; `og:locale:alternate` lists the other two. */
export function openGraphLocale(locale: Locale) {
  return { locale: OG_LOCALES[locale], alternateLocale: locales.filter((language) => language !== locale).map((language) => OG_LOCALES[language]) };
}
