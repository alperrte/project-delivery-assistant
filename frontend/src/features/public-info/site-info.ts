export const CONTACT_EMAIL = "pdassistant.info@gmail.com";
export const REPOSITORY_URL = "https://github.com/alperrte/project-delivery-assistant";
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
  { key: "accessibility", href: "/accessibility" },
  { key: "license", href: "/license" },
] as const;

export type InfoPage = (typeof INFO_LINKS)[number]["key"];
