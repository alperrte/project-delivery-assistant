import { getLocale, getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";

export async function generateMetadata() {
  const t = await getTranslations("forgotPassword");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: {
    canonical: buildPath("/forgot-password", {}, await getLocale() as Locale),
    languages: Object.fromEntries(locales.map((language) => [language, buildPath("/forgot-password", {}, language)])),
  } };
}

// The card's title/subtitle change with the step (email -> code), so the
// form owns its own AuthCard client-side instead of the page pre-rendering it.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
