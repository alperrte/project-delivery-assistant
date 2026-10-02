"use client";

import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import { FLAGS } from "@/components/layout/locale-switcher";
import { locales, type Locale } from "@/i18n/config";
import { OptionGroup } from "./option-group";

/** A choice in the draft only; nothing changes until the page's Kaydet. */
export function LanguageSection({ value, onChange }: { value: Locale; onChange: (next: Locale) => void }) {
  const t = useTranslations("preferences.language");
  const tl = useTranslations("common.language");

  const options = locales.map((code) => {
    const Flag = FLAGS[code];
    return { value: code, label: tl(code), icon: <Flag className="h-3.5 w-5 rounded-[2px]" /> };
  });

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <OptionGroup<Locale> name="language" label={t("label")} value={value} onChange={onChange} options={options} />
    </SettingsSection>
  );
}
