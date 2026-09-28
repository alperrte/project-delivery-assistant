import { Suspense } from "react";
import { CertificateIcon } from "@phosphor-icons/react/ssr";
import { getTranslations } from "next-intl/server";
import { GitHubIcon } from "@/components/common/brand-icons";
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
      <footer className="mx-auto mt-8 flex max-w-[30rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs font-medium text-(--auth-ink)">
        <span>{t("footer.copyright")}</span>
        <span aria-hidden="true">·</span>
        <a
          href="https://github.com/alperrte/project-delivery-assistant"
          className="inline-flex items-center gap-1 rounded-sm underline-offset-4 hover:text-(--auth-link) hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--glow)"
        >
          <GitHubIcon className="size-3.5 shrink-0" />
          {t("footer.github")}
        </a>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <CertificateIcon size={14} aria-hidden="true" />
          {t("footer.license")}
        </span>
      </footer>
    </>
  );
}
