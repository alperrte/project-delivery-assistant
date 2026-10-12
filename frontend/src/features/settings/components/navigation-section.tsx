"use client";

import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import type { NavbarMode } from "../api";
import { OptionGroup } from "./option-group";

export function NavigationSection({ value, onChange }: {
  value: NavbarMode;
  onChange: (next: NavbarMode) => void;
}) {
  const t = useTranslations("preferences.navigation");
  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <div className="space-y-2">
        <OptionGroup<NavbarMode>
          name="navbar-mode"
          label={t("title")}
          value={value}
          onChange={onChange}
          options={[
            { value: "always-visible", label: t("alwaysVisible") },
            { value: "auto-hide", label: t("autoHide") },
          ]}
        />
        <p className="text-xs leading-5 text-muted-foreground">{t("hint")}</p>
      </div>
    </SettingsSection>
  );
}
