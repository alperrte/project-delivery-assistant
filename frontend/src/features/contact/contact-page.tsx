import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";
import { PageJsonLd } from "@/lib/seo/json-ld";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { ContactForm } from "./contact-form";

export async function contactMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  const locale = await getLocale() as Locale;
  return {
    title: t("title"),
    description: t("description"),
    alternates: pageAlternates("/contact", locale),
    openGraph: pageOpenGraph("/contact", locale),
  };
}

/** Public: the form works for visitors who are not signed in. */
export async function ContactPage() {
  const t = await getTranslations("contact");
  const common = await getTranslations("common");
  const landing = await getTranslations("landing");
  return (
    <article data-contact-page className="mx-auto w-full max-w-2xl motion-safe:animate-[fade-up_280ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <PageJsonLd route="/contact" type="ContactPage" name={t("title")} description={t("description")} />
      <Breadcrumb label={common("breadcrumb")} items={[{ label: landing("homeTitle"), href: "/" }, { label: t("title") }]} className="mb-6" />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
      </header>
      <div className="mt-8">
        <ContactForm />
      </div>
    </article>
  );
}
