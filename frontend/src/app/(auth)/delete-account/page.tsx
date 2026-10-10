import { getLocale, getTranslations } from "next-intl/server";
import { DeleteAccountForm } from "@/features/auth/components/delete-account-form";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";

export async function generateMetadata() {
  const t = await getTranslations("deleteAccountPage");
  const locale = await getLocale() as Locale;
  // The URL carries a one-time token: keep it out of the index and never send it on as a referrer.
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: pageAlternates("/delete-account", locale), openGraph: pageOpenGraph("/delete-account", locale), robots: { index: false, follow: true }, referrer: "no-referrer" as const };
}

export default function DeleteAccountPage() {
  return <DeleteAccountForm />;
}
