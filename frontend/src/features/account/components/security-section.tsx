"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import { authApi } from "@/features/auth/api";
import { useSession } from "@/features/auth/hooks/use-session";
import { DeleteAccountPanel } from "./delete-account-panel";
import { PasswordChangePanel } from "./password-change-panel";
import { statusKey, TwoFactorPanel } from "./two-factor-panel";

/** Password (behind a mailed code), two-step verification and account deletion. */
export function SecuritySection() {
  const t = useTranslations("preferences.security");
  const tf = useTranslations("securityFlow");
  const { data: user } = useSession();
  const { data: status, isLoading } = useQuery({ queryKey: statusKey, queryFn: authApi.twoFactorStatus });
  if (!user) return null;

  // Accounts that only sign in with Google/GitHub have no password to change. Held back until the answer is known so
  // the card does not flash and vanish; if the status cannot be read, the card stays (the server still guards it).
  const showPassword = !isLoading && status?.passwordRequired !== false;

  return (
    <>
      {showPassword && (
        <SettingsSection title={t("title")} description={t("description")}>
          <PasswordChangePanel email={user.email} />
        </SettingsSection>
      )}
      <SettingsSection title={tf("twoFactor.title")} description={tf("twoFactor.description")}>
        <TwoFactorPanel />
      </SettingsSection>
      <SettingsSection title={tf("deleteAccount.title")} description={tf("deleteAccount.description")}>
        <DeleteAccountPanel email={user.email} />
      </SettingsSection>
    </>
  );
}
