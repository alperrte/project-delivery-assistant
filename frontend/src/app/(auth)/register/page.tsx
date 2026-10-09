import { RegisterPageContent } from "@/features/invitations/components/register-page-content";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("register");
  const locale = await getLocale() as Locale;
  return { title: t("title"), description: t("metaDescription"), alternates: pageAlternates("/register", locale), openGraph: pageOpenGraph("/register", locale) };
}

export default async function RegisterPage() {
  return <RegisterPageContent />;
}
