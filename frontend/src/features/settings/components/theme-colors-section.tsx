"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { SettingsSection } from "@/components/common/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionGroup } from "./option-group";
import { normalizeHex, type ThemeColors } from "../theme-colors";
import type { ThemeAnimation } from "../theme-animation";
import { AnimatedThemeEditor } from "./animated-theme-editor";

/** Native platform color dialog includes hue, tone and visual spectrum; HEX remains fully keyboard editable. */
function ColorField({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (value: string) => void }) {
  const t = useTranslations("preferences.colors");
  const id = useId();
  const valid = normalizeHex(value);
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <div className="flex gap-2">
      <input type="color" name={`${name}-picker`} aria-label={t("picker", { label })} value={valid ?? "#1B5FE0"}
        onChange={e => onChange(e.target.value.toUpperCase())} className="theme-native-picker size-11 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1" />
      <Input id={id} name={name} value={value} onChange={e => onChange(e.target.value)}
        onBlur={() => { if (valid) onChange(valid); }} placeholder="#1B5FE0" spellCheck={false} autoComplete="off"
        aria-invalid={!valid} aria-describedby={`${id}-hint`} className="h-11 min-w-0 font-mono uppercase" />
    </div>
    <p id={`${id}-hint`} aria-live="polite" className={`text-xs leading-5 ${valid ? "text-muted-foreground" : "text-destructive"}`}>
      {valid ? t("hexHint") : t("invalidHex")}
    </p>
  </div>;
}

export function ThemeColorsSection({ value, fallback, onChange, onReset, resetting, animation, onAnimationChange }: {
  value: ThemeColors; fallback: ThemeColors;
  onChange: (value: ThemeColors) => void; onReset: () => void; resetting: boolean;
  animation: ThemeAnimation; onAnimationChange: (value: ThemeAnimation) => void;
}) {
  const t = useTranslations("preferences.colors");
  const id = useId();
  const angleValid = Number.isInteger(value.gradientAngle) && value.gradientAngle >= 0 && value.gradientAngle <= 360;
  return <SettingsSection title={t("title")} description={t("description")}>
    <div className="space-y-6" data-theme-color-editor>
      <OptionGroup name="theme-colors" label={t("type")} value={value.themeType}
        options={[{ value: "SOLID", label: t("solid") }, { value: "GRADIENT", label: t("gradient") }, { value: "ANIMATED", label: t("animated") }]}
        onChange={themeType => onChange({ ...value, themeType,
          solidColor: normalizeHex(value.solidColor) ?? fallback.solidColor,
          gradientStartColor: normalizeHex(value.gradientStartColor) ?? fallback.gradientStartColor,
          gradientEndColor: normalizeHex(value.gradientEndColor) ?? fallback.gradientEndColor,
          gradientAngle: angleValid ? value.gradientAngle : fallback.gradientAngle,
        })} />
      {value.themeType === "ANIMATED" ? <AnimatedThemeEditor value={animation} onChange={onAnimationChange} /> : <>
      {value.themeType === "SOLID" ? <ColorField name="solidColor" label={t("solidColor")} value={value.solidColor} onChange={solidColor => onChange({ ...value, solidColor })} /> :
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField name="gradientStartColor" label={t("start")} value={value.gradientStartColor} onChange={gradientStartColor => onChange({ ...value, gradientStartColor })} />
          <ColorField name="gradientEndColor" label={t("end")} value={value.gradientEndColor} onChange={gradientEndColor => onChange({ ...value, gradientEndColor })} />
        </div>}
      {value.themeType === "GRADIENT" && <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={`${id}-angle`} className="text-sm font-medium">{t("angle")}</label>
          <Input id={`${id}-angle`} name="gradientAngle" autoComplete="off" type="number" min={0} max={360} step={1} value={Number.isFinite(value.gradientAngle) ? value.gradientAngle : ""}
            onChange={e => onChange({ ...value, gradientAngle: e.target.value === "" ? NaN : Number(e.target.value) })}
            aria-invalid={!angleValid} aria-describedby={!angleValid ? `${id}-angle-error` : undefined} className="h-11 w-24" />
        </div>
        <input type="range" name="gradientAngleSlider" min={0} max={360} step={1} value={angleValid ? value.gradientAngle : 135} aria-label={t("angleSlider")}
          className="h-11 w-full accent-primary" onChange={e => onChange({ ...value, gradientAngle: Number(e.target.value) })} />
        {!angleValid && <p id={`${id}-angle-error`} role="status" className="text-xs text-destructive">{t("invalidAngle")}</p>}
      </div>}
      </>}
      <Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal sm:w-auto" disabled={resetting} onClick={onReset}>
        {resetting ? t("resetting") : t("reset")}
      </Button>
    </div>
  </SettingsSection>;
}
