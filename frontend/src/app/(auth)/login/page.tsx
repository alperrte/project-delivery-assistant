import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { buildPath } from "@/i18n/routing";
import { locales, type Locale } from "@/i18n/config";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHero } from "@/features/auth/components/login-hero";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { OAuthErrorNotice } from "@/features/auth/components/oauth-error-notice";

export async function generateMetadata() {
  const t = await getTranslations("login");
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: {
    canonical: buildPath("/login", {}, await getLocale() as Locale),
    languages: Object.fromEntries(locales.map((language) => [language, buildPath("/login", {}, language)])),
  } };
}

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <div data-auth-fixed className="contents">
      <LoginHero />
      <AuthCard title={t("title")} subtitle={t("subtitle")} headingLevel={2}>
        <Suspense>
          <OAuthErrorNotice />
        </Suspense>
        <LoginForm>
          <OAuthButtons divider="or" />
        </LoginForm>
      </AuthCard>
    </div>
  );
}
