"use client";

import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import type { MotionPreference } from "@/lib/preferences/motion";
import { OptionGroup } from "./option-group";

type Toggle = "on" | "off";

/**
 * Two real controls, one for everything that moves (dialogs, menus, the sidebar, the language change) and one for
 * the circular reveal when the theme changes. Both are choices in the draft until the page's Kaydet.
 */
export function MotionSection({ motion, themeTransition, onMotionChange, onThemeTransitionChange }: {
  motion: MotionPreference;
  themeTransition: boolean;
  onMotionChange: (next: MotionPreference) => void;
  onThemeTransitionChange: (next: boolean) => void;
}) {
  const t = useTranslations("preferences.motion");
  // What the draft would give once saved: the transition cannot play when nothing is allowed to move.
  const blocked = motion === "off";

  const motionOptions = [
    { value: "on", label: t("ui.on") },
    { value: "off", label: t("ui.off") },
  ] as const;
  const toggleOptions = [
    { value: "on", label: t("theme.on") },
    { value: "off", label: t("theme.off") },
  ] as const;

  return (
    <SettingsSection title={t("title")} description={t("description")}>
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("ui.label")}</p>
          <OptionGroup<MotionPreference>
            name="motion"
            label={t("ui.label")}
            value={motion}
            onChange={onMotionChange}
            options={motionOptions}
          />
          <p className="text-xs leading-5 text-muted-foreground">{t("ui.hint")}</p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("theme.label")}</p>
          <OptionGroup<Toggle>
            name="theme-transition"
            label={t("theme.label")}
            value={themeTransition ? "on" : "off"}
            onChange={(next) => onThemeTransitionChange(next === "on")}
            options={toggleOptions}
            disabled={blocked}
          />
          <p className="text-xs leading-5 text-muted-foreground">{blocked ? t("theme.blocked") : t("theme.hint")}</p>
        </div>
      </div>
    </SettingsSection>
  );
}
