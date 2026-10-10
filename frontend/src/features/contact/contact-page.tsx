import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { Breadcrumb } from "@/components/common/breadcrumb";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";
import { PageJsonLd } from "@/lib/seo/json-ld";
import { CONTACT_EMAIL } from "@/features/public-info/site-info";
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
  const app = await getTranslations("common");
  const landing = await getTranslations("landing");
  return (
    <article className="max-w-2xl">
      <PageJsonLd route="/contact" type="ContactPage" name={t("title")} description={t("description")} />
      <Breadcrumb label={app("breadcrumb")} items={[{ label: landing("homeTitle"), href: "/" }, { label: t("title") }]} className="mb-6" />
      <header>
        <p className="text-sm font-medium text-muted-foreground">PDA · Project Delivery Assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
        <p className="mt-2 text-base leading-7 text-muted-foreground">
          {t("emailAlt")}{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">{CONTACT_EMAIL}</a>
        </p>
      </header>
      <div className="mt-8">
        <ContactForm />
      </div>
    </article>
  );
}
