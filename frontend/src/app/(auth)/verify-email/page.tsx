import { getLocale, getTranslations } from "next-intl/server";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("verifyEmail");
  const locale = await getLocale() as Locale;
  // A one-time code form has nothing to search for. `noindex` only works while crawlers may fetch the page, so robots.txt leaves it open.
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: pageAlternates("/verify-email", locale), openGraph: pageOpenGraph("/verify-email", locale), robots: { index: false, follow: true } };
}

// The card's title and subtitle change with the step (address -> code), so the form owns its own AuthCard client-side.
export default function VerifyEmailPage() {
  return <VerifyEmailForm />;
}
