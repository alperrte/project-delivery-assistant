import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { CaretDown } from "@phosphor-icons/react/ssr";
import { APACHE_LICENSE_TEXT } from "./apache-license";
import { CONTACT_EMAIL, type InfoPage } from "./site-info";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";

type Section = { id: string; title: string; paragraphs: string[]; items?: string[] };
type FaqGroup = { id: string; title: string; questions: { question: string; answer: string }[] };

export async function infoMetadata(page: InfoPage): Promise<Metadata> {
  const t = await getTranslations("publicPages." + page);
  const locale = await getLocale() as Locale;
  const route = `/${page}` as const;
  return {
    title: t("title"), description: t("description"),
    alternates: { canonical: buildPath(route, {}, locale), languages: Object.fromEntries(locales.map((language) => [language, buildPath(route, {}, language)])) },
    ...(page === "kvkk" || page === "privacy" ? { robots: { index: false, follow: true } } : {}),
  };
}

export async function PublicInfoPage({ page }: { page: InfoPage }) {
  const t = await getTranslations("publicPages." + page);
  const common = await getTranslations("publicPages.common");
  const locale = await getLocale();
  const sections: Section[] = page === "faq" ? [] : t.raw("sections");
  const groups: FaqGroup[] = page === "faq" ? t.raw("groups") : [];
  const isLicense = page === "license";
  const contents = page === "faq" ? groups : isLicense ? [...sections, { id: "full-text", title: t("fullTextTitle") }] : sections;
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul" }).format(new Date("2026-10-02T12:00:00+03:00"));

  return (
    <article>
      <header className="max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">PDA · Project Delivery Assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
        {!isLicense && <p className="mt-4 text-sm text-muted-foreground">{common("updated", { date })}</p>}
      </header>
      {(page === "kvkk" || page === "privacy") && (
        <aside aria-label={common("reviewTitle")} className="mt-8 rounded-lg border border-border bg-muted p-5">
          <h2 className="text-base font-semibold">{common("reviewTitle")}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">{common("reviewNotice")}</p>
        </aside>
      )}
      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label={common("contents")} className="lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-sm font-semibold">{common("contents")}</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 lg:block lg:space-y-1">
            {contents.map(({ id, title }) => <li key={id}><a href={"#" + id} className="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{title}</a></li>)}
          </ul>
        </nav>
        <div className="min-w-0">
          {page === "faq" ? groups.map(group => (
            <section key={group.id} id={group.id} aria-labelledby={group.id + "-title"} className="mb-10 scroll-mt-6">
              <h2 id={group.id + "-title"} className="mb-4 text-xl font-semibold">{group.title}</h2>
              <div className="divide-y divide-border border-y border-border">
                {group.questions.map(({ question, answer }, index) => (
                  <details key={question} className="group">
                    <summary aria-controls={group.id + "-answer-" + index} className="flex list-none items-start justify-between gap-4 py-5 text-base font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
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
              {/* Scrollable region: focusable so keyboard users can scroll it; the legal text stays in its original English. */}
              <pre lang="en" tabIndex={0} aria-label={t("fullTextTitle")} className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted p-4 font-mono text-xs leading-5 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{APACHE_LICENSE_TEXT}</pre>
            </section>
          )}
          {(page === "kvkk" || page === "privacy") && (
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
            <a href={"mailto:" + CONTACT_EMAIL} className="mt-2 inline-flex min-h-11 items-center break-all rounded-md font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{CONTACT_EMAIL}</a>
          </aside>
        </div>
      </div>
    </article>
  );
}
