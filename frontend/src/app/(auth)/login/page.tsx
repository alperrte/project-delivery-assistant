import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginForm } from "@/features/auth/components/login-form";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { OAuthErrorNotice } from "@/features/auth/components/oauth-error-notice";

export default async function LoginPage() {
  const t = await getTranslations("login");
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <Suspense>
        <OAuthErrorNotice />
      </Suspense>
      <OAuthButtons />
      <div className="mt-4">
        <LoginForm />
      </div>
    </AuthCard>
  );
}
