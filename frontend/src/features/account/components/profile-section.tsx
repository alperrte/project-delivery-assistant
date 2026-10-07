"use client";

import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import type { AuthenticatedUser } from "@/features/auth/api";
import { ProfilePhotoField } from "./profile-photo-field";
import { NicknameField } from "./nickname-field";

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-all text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function ProfileSection({ user }: { user: AuthenticatedUser }) {
  const t = useTranslations("preferences.profile");
  const ta = useTranslations("account");
  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <div className="mb-6">
        <ProfilePhotoField user={user} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><NicknameField key={user.id} user={user} /></div>
        <dl><ProfileRow label={ta("email")} value={user.email} /></dl>
      </div>
    </SettingsSection>
  );
}
