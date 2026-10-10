import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { type Locale } from "@/i18n/config";
import { pageAlternates, pageOpenGraph } from "@/lib/seo/alternates";
import { LoginFlow } from "@/features/auth/components/login-flow";
import { LoginHero } from "@/features/auth/components/login-hero";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { OAuthErrorNotice } from "@/features/auth/components/oauth-error-notice";

export async function generateMetadata() {
  const t = await getTranslations("login");
  const locale = await getLocale() as Locale;
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: pageAlternates("/login", locale), openGraph: pageOpenGraph("/login", locale) };
}

export default function LoginPage() {
  return (
    <div data-auth-fixed className="contents">
      <LoginHero />
      <LoginFlow
        notice={
          <Suspense>
            <OAuthErrorNotice />
          </Suspense>
        }
        oauth={<OAuthButtons divider="or" />}
      />
    </div>
  );
}
