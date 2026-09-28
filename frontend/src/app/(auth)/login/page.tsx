import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { LoginHero } from "@/features/auth/components/login-hero";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { OAuthErrorNotice } from "@/features/auth/components/oauth-error-notice";

export async function generateMetadata() {
  const t = await getTranslations("login");
  return { title: t("metaTitle") };
}

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <>
      <LoginHero />
      <AuthCard title={t("title")} subtitle={t("subtitle")} headingLevel={2}>
        <Suspense>
          <OAuthErrorNotice />
        </Suspense>
        <LoginForm>
          <OAuthButtons divider="or" />
        </LoginForm>
      </AuthCard>
    </>
  );
}
