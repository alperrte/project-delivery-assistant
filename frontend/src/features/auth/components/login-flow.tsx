"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Info } from "@phosphor-icons/react";
import { AuthCard } from "./auth-card";
import { LoginForm } from "./login-form";
import { TwoFactorLoginForm } from "./two-factor-login-form";
import { useQueryParams } from "./use-client-state";

/**
 * The login card owns the sign-in steps: credentials first, then (only for accounts with two-step verification) the
 * authenticator code. `?step=2fa` is where the OAuth callback sends a Google/GitHub sign-in that needs the code, and
 * `?reason=session-expired` is where the app shell sends a visitor whose session ended.
 */
export function LoginFlow({ notice, oauth }: { notice: ReactNode; oauth: ReactNode }) {
  const t = useTranslations("login");
  const params = useQueryParams();
  // The user's own moves (back, or a second factor asked for after the password) win over what the URL started with.
  const [chosenStep, setStep] = useState<"credentials" | "2fa" | null>(null);
  const [backup, setBackup] = useState(false);
  const step = chosenStep ?? (params?.get("step") === "2fa" ? "2fa" : "credentials");
  const sessionEnded = params?.get("reason") === "session-expired";

  if (step === "2fa") {
    return (
      <AuthCard
        title={t("twoFactorTitle")}
        subtitle={backup ? t("twoFactorBackupSubtitle") : t("twoFactorSubtitle")}
        headingLevel={2}
      >
        <TwoFactorLoginForm
          backup={backup}
          onToggleBackup={() => setBackup((value) => !value)}
          onBack={() => setStep("credentials")}
          onExpired={() => setStep("credentials")}
        />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")} headingLevel={2}>
      {sessionEnded && (
        <div
          role="status"
          className="mb-5 flex gap-3 rounded-lg border border-(--auth-field-border) bg-(--auth-field) p-3 text-sm"
        >
          <Info aria-hidden size={20} weight="fill" className="mt-0.5 shrink-0 text-(--auth-link)" />
          <p>{t("sessionExpired")}</p>
        </div>
      )}
      {notice}
      <LoginForm onTwoFactor={() => { setBackup(false); setStep("2fa"); }}>{oauth}</LoginForm>
    </AuthCard>
  );
}
