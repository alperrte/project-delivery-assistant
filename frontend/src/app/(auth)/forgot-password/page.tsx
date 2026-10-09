import { getLocale, getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { type Locale } from "@/i18n/config";
import { pageAlternates } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("forgotPassword");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: pageAlternates("/forgot-password", await getLocale() as Locale) };
}

// The card's title/subtitle change with the step (email -> code), so the
// form owns its own AuthCard client-side instead of the page pre-rendering it.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
