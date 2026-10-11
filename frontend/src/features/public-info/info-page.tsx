import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CaretDown } from "@phosphor-icons/react/ssr";
import Link from "@/i18n/navigation";
import { APACHE_LICENSE_TEXT } from "./apache-license";
import { PageContents } from "./page-contents";
import { CONTACT_HREF, type InfoPage } from "./site-info";
import { type Locale } from "@/i18n/config";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";
import { FaqJsonLd, PageJsonLd } from "@/lib/seo/json-ld";
import { ManageCookiePreferencesButton } from "@/features/consent/manage-cookie-preferences-button";

type Section = { id: string; title: string; paragraphs: string[]; items?: string[] };
type FaqGroup = { id: string; title: string; questions: { question: string; answer: string }[] };

/** Policy pages that are drafts until the legal details are confirmed: they carry the review notice and the official references. */
const isLegalPage = (page: InfoPage) => page === "kvkk" || page === "privacy" || page === "cookies";

export async function infoMetadata(page: InfoPage): Promise<Metadata> {
  const t = await getTranslations("publicPages." + page);
  const locale = await getLocale() as Locale;
  const route = `/${page}` as const;
  return {
    title: t("title"), description: t("description"),
    alternates: pageAlternates(route, locale),
    openGraph: pageOpenGraph(route, locale),
    ...(isLegalPage(page) ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function PublicInfoPage({ page }: { page: InfoPage }) {
  const t = await getTranslations("publicPages." + page);
  const common = await getTranslations("publicPages.common");
  const app = await getTranslations("common");
  const landing = await getTranslations("landing");
  const locale = await getLocale();
  const sections: Section[] = page === "faq" ? [] : t.raw("sections");
  const groups: FaqGroup[] = page === "faq" ? t.raw("groups") : [];
  const isLicense = page === "license";
  const contents = page === "faq" ? groups : isLicense ? [...sections, { id: "full-text", title: t("fullTextTitle") }] : sections;
  const updatedAt = page === "accessibility" ? "2026-10-11T12:00:00+03:00" : "2026-10-09T12:00:00+03:00";
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date(updatedAt));

  return (
    <article>
      <Breadcrumb label={app("breadcrumb")} items={[{ label: landing("homeTitle"), href: "/" }, { label: t("title") }]} className="mb-6" />
      <PageJsonLd route={`/${page}`} type={page === "about" ? "AboutPage" : "WebPage"} name={t("title")} description={t("description")} />
      {page === "faq" && <FaqJsonLd questions={groups.flatMap((group) => group.questions)} />}
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">PDA · Project Delivery Assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
        {!isLicense && <p className="mt-4 text-sm text-muted-foreground">{common("updated", { date })}</p>}
      </header>
      {isLegalPage(page) && (
        <aside aria-label={common("reviewTitle")} className="mt-8 rounded-lg border border-border bg-muted p-5">
          <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">{common("reviewNotice")}</p>
        </aside>
      )}
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <PageContents label={common("contents")} items={contents} />
        <div className="min-w-0">
          {page === "faq" ? groups.map(group => (
            <section key={group.id} id={group.id} aria-labelledby={group.id + "-title"} className="mb-10 scroll-mt-6">
              <h2 id={group.id + "-title"} className="mb-4 text-xl font-semibold">{group.title}</h2>
              <div className="divide-y divide-border border-y border-border">
                {group.questions.map(({ question, answer }, index) => (
                  <details key={question} className="group">
                    <summary aria-controls={group.id + "-answer-" + index} className="flex list-none items-start justify-between gap-4 py-5 text-base font-medium outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                      {question}<CaretDown size={18} aria-hidden="true" className="mt-1 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <p id={group.id + "-answer-" + index} className="pb-5 pr-6 text-base leading-7 text-muted-foreground">{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )) : sections.map(section => (
            <section key={section.id} id={section.id} aria-labelledby={section.id + "-title"} className="mb-10 scroll-mt-6">
              <h2 id={section.id + "-title"} className="mb-4 text-xl font-semibold">{section.title}</h2>
              <div className="space-y-4 text-base leading-7 text-muted-foreground">
                {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                {section.items && <ul className="list-disc space-y-2 pl-5">{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
              </div>
            </section>
          ))}
          {isLicense && (
            <section id="full-text" aria-labelledby="full-text-title" className="mb-10 scroll-mt-6">
              <h2 id="full-text-title" className="mb-4 text-xl font-semibold">{t("fullTextTitle")}</h2>
              <p className="mb-4 text-base leading-7 text-muted-foreground">{t("fullTextNote")}</p>
              {/* Scrollable box: focusable so keyboard users can scroll it; role="group" is what lets a `pre` carry the aria-label (the surrounding section is already the landmark). The legal text stays in its original English. */}
              <pre lang="en" tabIndex={0} role="group" aria-label={t("fullTextTitle")} className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-5 outline-hidden focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{APACHE_LICENSE_TEXT}</pre>
            </section>
          )}
          {page === "cookies" && (
            <div className="mb-10 border-t border-border pt-6">
              <h2 className="text-lg font-semibold">{t("manageTitle")}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("manageText")}</p>
              <div className="mt-4"><ManageCookiePreferencesButton /></div>
            </div>
          )}
          {isLegalPage(page) && (
            <nav aria-label={common("references")} className="mb-8 border-t border-border pt-6">
              <h2 className="text-lg font-semibold">{common("references")}</h2>
              <ul className="mt-2 space-y-2 text-sm">
                <li><a href="https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-" className="inline-flex min-h-11 items-center rounded-md text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{common("noticeReference")}</a></li>
                <li><a href="https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber" className="inline-flex min-h-11 items-center rounded-md text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{common("cookieReference")}</a></li>
              </ul>
            </nav>
          )}
          <aside className="border-t border-border pt-6">
            <h2 className="text-lg font-semibold">{common("contactTitle")}</h2>
            <p className="mt-2 text-base leading-7 text-muted-foreground">{common("contactText")}</p>
            <Link href={CONTACT_HREF} className="mt-2 inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{common("contactAction")}</Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
