import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/features/auth/components/auth-card";
import { OAuthButtons } from "@/features/auth/components/oauth-buttons";
import { RegisterForm } from "@/features/auth/components/register-form";

export default async function RegisterPage() {
  const t = await getTranslations("register");
  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <OAuthButtons />
      <div className="mt-5">
        <RegisterForm />
      </div>
    </AuthCard>
  );
}
