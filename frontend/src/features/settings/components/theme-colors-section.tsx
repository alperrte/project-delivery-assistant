"use client";

import { useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { SettingsSection } from "@/components/common/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionGroup } from "./option-group";
import { DEFAULT_THEME_COLORS, normalizeHex, normalizeThemeColors, themePalette, themeSwatch, type ThemeColors } from "../theme-colors";
import type { ThemeAnimation } from "../theme-animation";
import { AnimatedThemeEditor } from "./animated-theme-editor";

const PRESETS = ["#1B5FE0", "#C8323A", "#147A52", "#6D4FD0", "#C45B12", "#EBCB22", "#C0307A", "#52607A"];
const GRADIENTS = [["#1B5FE0", "#8B5CF6"], ["#C8323A", "#090A0B"], ["#EA580C", "#DB2777"], ["#147A52", "#0B7A85"]];

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

export function ThemeColorsSection({ value, fallback, appearance, onChange, onReset, resetting, animation, onAnimationChange }: {
  value: ThemeColors; fallback: ThemeColors; appearance: "system" | "light" | "dark";
  onChange: (value: ThemeColors) => void; onReset: () => void; resetting: boolean;
  animation: ThemeAnimation; onAnimationChange: (value: ThemeAnimation) => void;
}) {
  const t = useTranslations("preferences.colors");
  const { systemTheme } = useTheme();
  const id = useId();
  const safe = normalizeThemeColors(value) ?? normalizeThemeColors(fallback) ?? DEFAULT_THEME_COLORS;
  const dark = appearance === "dark" || (appearance === "system" && systemTheme === "dark");
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
      <div>
        <p className="mb-2 text-sm font-medium">{t("presets")}</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("presets")}>
          {value.themeType === "SOLID" ? PRESETS.map((color, index) => <button key={color} type="button"
            aria-label={t(`presetNames.${index}`)} aria-pressed={normalizeHex(value.solidColor) === color}
            onClick={() => onChange({ ...value, solidColor: color })}
            className="flex size-11 items-center justify-center rounded-md border border-input aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-ring">
            <span className="size-6 rounded-sm border border-black/15" style={{ background: color }} />
          </button>) : GRADIENTS.map(([start, end], index) => <button key={start} type="button"
            aria-label={t(`gradientNames.${index}`)}
            aria-pressed={normalizeHex(value.gradientStartColor) === start && normalizeHex(value.gradientEndColor) === end}
            onClick={() => onChange({ ...value, gradientStartColor: start, gradientEndColor: end })}
            className="flex h-11 w-16 items-center justify-center rounded-md border border-input aria-pressed:outline aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-ring">
            <span className="h-6 w-11 rounded-sm border border-black/15" style={{ background: `linear-gradient(135deg, ${start}, ${end})` }} />
          </button>)}
        </div>
      </div>
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
        <div className="flex flex-wrap gap-2">
          {([90, 180, 135] as const).map((angle, index) => <Button key={angle} type="button" variant="outline" className="min-h-11"
            aria-pressed={value.gradientAngle === angle} onClick={() => onChange({ ...value, gradientAngle: angle })}>{t(`directions.${index}`)}</Button>)}
        </div>
        {!angleValid && <p id={`${id}-angle-error`} role="status" className="text-xs text-destructive">{t("invalidAngle")}</p>}
      </div>}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t("preview")}</p>
        <div data-theme-preview data-preview-dark={dark} className="theme-color-preview overflow-hidden rounded-lg border"
          style={themePalette(safe, dark) as CSSProperties}>
          <div className="h-12 border-b" style={{ background: themeSwatch(safe) }} aria-hidden="true" />
          <div className="flex gap-4 p-4">
            <div aria-hidden="true" className="hidden w-16 shrink-0 space-y-3 border-r pr-4 sm:block">
              <div className="h-2 rounded bg-primary" /><div className="h-2 rounded bg-muted-foreground/25" /><div className="h-2 rounded bg-muted-foreground/25" />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <p className="text-sm font-semibold">{t("sampleTitle")}</p>
              <p className="text-sm text-muted-foreground">{t("sampleText")}</p>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span data-theme-action className="rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground">{t("sampleAction")}</span>
                <span className="text-primary underline underline-offset-4">{t("sampleLink")}</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{t("previewHint")}</p>
      </div>
      </>}
      <Button type="button" variant="outline" className="min-h-11 w-full whitespace-normal sm:w-auto" disabled={resetting} onClick={onReset}>
        {resetting ? t("resetting") : t("reset")}
      </Button>
    </div>
  </SettingsSection>;
}
