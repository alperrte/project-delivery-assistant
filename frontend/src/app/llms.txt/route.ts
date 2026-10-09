import landing from "@/i18n/landing/en.json";
import { locales } from "@/i18n/config";
import { buildPath, type PageRoute } from "@/i18n/routing";
import { CONTACT_EMAIL, REPOSITORY_URL } from "@/features/public-info/site-info";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const PAGES: { route: PageRoute; title: string; note: string }[] = [
  { route: "/", title: "Home", note: "What PDA is and what it does" },
  { route: "/about", title: "About", note: "The story and the team behind PDA" },
  { route: "/faq", title: "FAQ", note: "Answers about accounts, projects, teams, privacy and support" },
  { route: "/license", title: "License", note: "Apache License 2.0 summary and full text" },
  { route: "/accessibility", title: "Accessibility", note: "Accessibility statement" },
];

/** A plain-text summary for AI assistants, in the llms.txt format: title, summary, then links grouped by topic. */
export async function GET() {
  const links = PAGES.map(({ route, title, note }) =>
    `- ${title} (${locales.map((locale) => `[${locale}](${SITE_URL}${buildPath(route, {}, locale)})`).join(", ")}): ${note}`);

  const body = [
    "# PDA · Project Delivery Assistant",
    "",
    `> ${landing.metaDescription}`,
    "",
    "PDA is open-source software for planning and delivering project work: projects, teams, tasks, sprints, a project repository view and reminders.",
    "You can run it on your own infrastructure. The backend and database start with Docker and the interface runs on Node.js.",
    "The public site is available in Turkish (tr), English (en) and German (de). Pages behind the sign-in are private and not meant for indexing.",
    "",
    "## Public pages",
    "",
    ...links,
    "",
    "## Source and license",
    "",
    `- [Source code on GitHub](${REPOSITORY_URL}): installation steps are in the README`,
    "- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0): the license the source code is released under",
    "",
    "## Contact",
    "",
    `- ${CONTACT_EMAIL}`,
    "",
  ].join("\n");

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
