import { getLocale, getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { type Locale } from "@/i18n/config";
import { pageAlternates } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("forgotPassword");
  // A reset form has no content to search for. `noindex` only works while crawlers may fetch the page, so robots.txt leaves it open.
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: pageAlternates("/forgot-password", await getLocale() as Locale), robots: { index: false, follow: true } };
}

// The card's title/subtitle change with the step (email -> code), so the
// form owns its own AuthCard client-side instead of the page pre-rendering it.
export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
