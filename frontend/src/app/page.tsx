import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import { LandingPage } from "@/features/landing/landing-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  const locale = await getLocale() as Locale;
  const home = buildPath("/", {}, locale);
  return {
    title: { absolute: `${t("metaTitle")} · PDA` }, description: t("metaDescription"),
    alternates: { canonical: home, languages: Object.fromEntries(locales.map((language) => [language, buildPath("/", {}, language)])) },
    openGraph: {
      type: "website", title: t("metaTitle"), description: t("metaDescription"), url: home,
      images: [{ url: "/images/branding/pda-full.png", alt: "PDA · Project Delivery Assistant" }],
    },
  };
}

export default async function Home() {
  // The hint only selects a destination; AppShell and the API verify the session.
  if ((await cookies()).has("PDA_SESSION")) redirect(buildPath("/dashboard", {}, await getLocale() as Locale));
  return <LandingPage />;
}
