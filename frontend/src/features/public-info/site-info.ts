/** The public contact form. Every "contact" link in the application goes here; no e-mail address is shown. */
export const CONTACT_HREF = "/contact";
export const REPOSITORY_URL = "https://github.com/alperrte/project-delivery-assistant";
export const CONTRIBUTORS = [
  { name: "Alper Temiz", github: "https://github.com/alperrte" },
  { name: "Hamza Taşbay", github: "https://github.com/HmzT270" },
] as const;

export const INFO_LINKS = [
  { key: "faq", href: "/faq" },
  { key: "kvkk", href: "/kvkk" },
  { key: "privacy", href: "/privacy" },
  { key: "cookies", href: "/cookies" },
  { key: "accessibility", href: "/accessibility" },
] as const;

export type InfoPage = (typeof INFO_LINKS)[number]["key"];
