import { getLocale, getTranslations } from "next-intl/server";
import { buildPath, type PageRoute } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { CONTACT_EMAIL, REPOSITORY_URL } from "@/features/public-info/site-info";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const LOGO_PATH = "/images/branding/pda-full.png";
const APACHE_2_URL = "https://www.apache.org/licenses/LICENSE-2.0";

/** `<` is escaped so a value can never close the script element. */
function serialize(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(data) }} />;
}

/** A public information page: its type, its place in the site and the path back to the home page. */
export async function PageJsonLd({ route, type = "WebPage", name, description }: { route: PageRoute; type?: "WebPage" | "AboutPage"; name: string; description: string }) {
  const locale = await getLocale() as Locale;
  const t = await getTranslations("landing");
  const url = `${SITE_URL}${buildPath(route, {}, locale)}`;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": type,
            "@id": `${url}#webpage`,
            url, name, description,
            inLanguage: locale,
            isPartOf: { "@id": `${SITE_URL}/#website` },
            breadcrumb: { "@id": `${url}#breadcrumb` },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${url}#breadcrumb`,
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t("homeTitle"), item: `${SITE_URL}${buildPath("/", {}, locale)}` },
              { "@type": "ListItem", position: 2, name, item: url },
            ],
          },
        ],
      }}
    />
  );
}

/** Question and answer pairs exactly as the FAQ page shows them, so the data never says more than the page. */
export function FaqJsonLd({ questions }: { questions: { question: string; answer: string }[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: questions.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: { "@type": "Answer", text: answer },
        })),
      }}
    />
  );
}

/** Structured data for the public home page: who runs the site, what the site is, and what the software is. */
export async function HomeJsonLd() {
  const locale = await getLocale() as Locale;
  const t = await getTranslations("landing");
  const url = `${SITE_URL}${buildPath("/", {}, locale)}`;
  const logo = `${SITE_URL}${LOGO_PATH}`;
  const description = t("metaDescription");

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": `${SITE_URL}/#organization`,
            name: "PDA · Project Delivery Assistant",
            url: SITE_URL,
            logo,
            sameAs: [REPOSITORY_URL],
            contactPoint: { "@type": "ContactPoint", email: CONTACT_EMAIL, contactType: "customer support" },
          },
          {
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            name: "PDA",
            url,
            inLanguage: locale,
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
          {
            "@type": "SoftwareApplication",
            "@id": `${SITE_URL}/#software`,
            name: "PDA · Project Delivery Assistant",
            description,
            url,
            image: logo,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            isAccessibleForFree: true,
            license: APACHE_2_URL,
            codeRepository: REPOSITORY_URL,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            publisher: { "@id": `${SITE_URL}/#organization` },
          },
        ],
      }}
    />
  );
}
