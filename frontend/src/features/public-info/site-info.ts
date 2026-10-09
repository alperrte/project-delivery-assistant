export const CONTACT_EMAIL = "pdassistant.info@gmail.com";
export const REPOSITORY_URL = "https://github.com/alperrte/project-delivery-assistant";
export const CONTRIBUTORS = [
  { name: "Alper Temiz", github: "https://github.com/alperrte" },
  { name: "Hamza Taşbay", github: "https://github.com/HmzT270" },
] as const;

export const INFO_LINKS = [
  { key: "faq", href: "/faq" },
  { key: "kvkk", href: "/kvkk" },
  { key: "privacy", href: "/privacy" },
  { key: "accessibility", href: "/accessibility" },
  { key: "license", href: "/license" },
] as const;

export type InfoPage = (typeof INFO_LINKS)[number]["key"];
