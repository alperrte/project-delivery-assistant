"use client";

import { useTranslations } from "next-intl";
import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { SettingsSection } from "@/components/common/settings-section";
import type { ThemeChoice } from "../api";
import { OptionGroup } from "./option-group";

/** Light, dark, or follow the device. A choice in the draft only; nothing changes until the page's Kaydet. */
export function AppearanceSection({ value, onChange }: { value: ThemeChoice; onChange: (next: ThemeChoice) => void }) {
  const t = useTranslations("preferences.appearance");
  const tt = useTranslations("common.theme");

  const options = [
    { value: "system", label: tt("system"), icon: <Desktop size={16} aria-hidden="true" /> },
    { value: "light", label: tt("light"), icon: <Sun size={16} aria-hidden="true" /> },
    { value: "dark", label: tt("dark"), icon: <Moon size={16} aria-hidden="true" /> },
  ] as const;

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <OptionGroup<ThemeChoice> name="theme" label={t("label")} value={value} onChange={onChange} options={options} />
    </SettingsSection>
  );
}
