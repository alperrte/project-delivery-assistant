import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPath } from "@/i18n/routing";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";
import { LandingPage } from "@/features/landing/landing-page";
import { HomeJsonLd } from "@/lib/seo/json-ld";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("landing");
  const locale = await getLocale() as Locale;
  return {
    // The tab shows the page name; the slogan stays as the social-share title below.
    title: { absolute: `${t("homeTitle")} · PDA` }, description: t("metaDescription"),
    alternates: pageAlternates("/", locale),
    openGraph: { ...pageOpenGraph("/", locale), title: t("metaTitle"), description: t("metaDescription") },
  };
}

export default async function Home() {
  // The hint only selects a destination; AppShell and the API verify the session.
  if ((await cookies()).has("PDA_SESSION")) redirect(buildPath("/dashboard", {}, await getLocale() as Locale));
  return (
    <>
      <HomeJsonLd />
      <LandingPage />
    </>
  );
}
