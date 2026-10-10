/** The public contact form. Application support links go here; contributor profile contacts remain separate. */
export const CONTACT_HREF = "/contact";
export const CONTACT_EMAIL = "pdassistant.info@gmail.com";
export const REPOSITORY_URL = "https://github.com/alperrte/project-delivery-assistant";
/** Release shown in the footer. Keep in sync with the git tag and the package versions when a release is cut. */
export const APP_VERSION = "1.0";
export const CONTRIBUTORS = [
  {
    name: "Alper Temiz",
    github: "https://github.com/alperrte",
    linkedin: "https://www.linkedin.com/in/alpertemizz/",
    email: "alpertemiz15@gmail.com",
    cv: "/cv/alper-temiz-cv.pdf",
    photo: "/images/team/alper-temiz.webp",
  },
  {
    name: "Hamza Taşbay",
    github: "https://github.com/HmzT270",
    linkedin: "https://www.linkedin.com/in/hamza-ta%C5%9Fbay-3b7b94304/",
    email: "tasbayh@gmail.com",
    cv: "/cv/hamza-tasbay-cv.pdf",
    photo: "/images/team/hamza-tasbay.webp",
  },
] as const;

export const INFO_LINKS = [
  { key: "about", href: "/about" },
  { key: "faq", href: "/faq" },
  { key: "kvkk", href: "/kvkk" },
  { key: "privacy", href: "/privacy" },
  { key: "terms", href: "/terms" },
  { key: "cookies", href: "/cookies" },
  { key: "accessibility", href: "/accessibility" },
  { key: "license", href: "/license" },
] as const;

/**
 * When each information page last changed in substance (ISO date, Istanbul time). Pages not listed use the earlier
 * default. Update the entry when the text of a page changes; the legal pages show it as "Last updated".
 */
export const PAGE_UPDATED: Partial<Record<InfoPage, string>> = {
  kvkk: "2026-10-11", privacy: "2026-10-11", terms: "2026-10-11", cookies: "2026-10-11", accessibility: "2026-10-11", faq: "2026-10-11",
};
export const DEFAULT_PAGE_UPDATED = "2026-10-09";

export type InfoPage = (typeof INFO_LINKS)[number]["key"];
