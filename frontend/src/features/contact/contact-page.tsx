import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import { ContactForm } from "./contact-form";

export async function contactMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact");
  const locale = await getLocale() as Locale;
  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: buildPath("/contact", {}, locale),
      languages: Object.fromEntries(locales.map((language) => [language, buildPath("/contact", {}, language)])),
    },
  };
}

/** Public: the form works for visitors who are not signed in. */
export async function ContactPage() {
  const t = await getTranslations("contact");
  return (
    <article className="max-w-2xl">
      <header>
        <p className="text-sm font-medium text-muted-foreground">PDA · Project Delivery Assistant</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{t("description")}</p>
      </header>
      <div className="mt-8">
        <ContactForm />
      </div>
    </article>
  );
}
