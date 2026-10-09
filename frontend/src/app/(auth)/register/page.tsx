import { RegisterPageContent } from "@/features/invitations/components/register-page-content";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { pageAlternates } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("register");
  return { title: t("title"), description: t("metaDescription"), alternates: pageAlternates("/register", await getLocale() as Locale) };
}

export default async function RegisterPage() {
  return <RegisterPageContent />;
}
