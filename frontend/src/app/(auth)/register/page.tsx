import { RegisterPageContent } from "@/features/invitations/components/register-page-content";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("register");
  return { title: t("title"), alternates: {
    canonical: buildPath("/register", {}, await getLocale() as Locale),
    languages: Object.fromEntries(locales.map((language) => [language, buildPath("/register", {}, language)])),
  } };
}

export default async function RegisterPage() {
  return <RegisterPageContent />;
}
