"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { ANIMATION_PRESETS, type ThemeAnimation } from "../theme-animation";
import { ThemeScene } from "../effects/theme-scene";
import { usePageVisible } from "../effects/theme-effects";

export function AnimatedThemeEditor({ value, onChange }: { value: ThemeAnimation; onChange: (value: ThemeAnimation) => void }) {
  const t = useTranslations("preferences.animation");
  const id = useId();
  const reduced = useReducedMotionPreference(), visible = usePageVisible();
  const validVolume = Number.isInteger(value.soundVolume) && value.soundVolume >= 0 && value.soundVolume <= 100;
  return <div className="space-y-5" data-animation-editor>
    <fieldset>
      <legend className="mb-3 text-sm font-medium">{t("presets")}</legend>
      <div className="grid grid-cols-2 gap-3">
        {ANIMATION_PRESETS.map(preset => <label key={preset} className="relative cursor-pointer overflow-hidden rounded-lg border border-input p-3 hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring">
          <div className="theme-preset-art mb-3 h-16 rounded" data-preset={preset} aria-hidden="true">
            <svg viewBox="0 0 200 64" className="size-full" fill="none" stroke="currentColor" strokeWidth="1.5">
              {preset === "WATER" ? [20, 32, 44].map(y => <path key={y} d={`M15 ${y} Q40 ${y - 12} 65 ${y} T115 ${y} T165 ${y} T215 ${y}`} />) : preset === "SNOW" ? [30, 65, 105, 145, 175].map((x, i) => <circle key={x} cx={x} cy={14 + i % 3 * 17} r={2 + i % 2} fill="currentColor" stroke="none" />) : <>
                {[35, 65, 95, 125, 155, 180].map((x, i) => <path key={x} d={`M${x} ${12 + i % 3 * 8} l-7 22`} />)}
                {preset === "THUNDERSTORM" && <path d="M120 6 108 28h11l-17 29 7-22H98z" />}
              </>}
            </svg>
          </div>
          <span className="flex min-h-6 items-start gap-2 text-sm font-medium">
            <input className="mt-1 size-4 shrink-0 accent-primary" type="radio" aria-label={t(`names.${preset}`)} name={`${id}-preset`} value={preset} checked={value.animation === preset} onChange={() => onChange({ ...value, animation: preset })} />
            {t(`names.${preset}`)}
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{t(`descriptions.${preset}`)}</span>
        </label>)}
      </div>
    </fieldset>
    <div className="relative h-40 overflow-hidden rounded-lg border bg-background" aria-label={t("preview")} role="img">
      <ThemeScene preset={value.animation} running={value.animationEnabled && !reduced && visible} preview />
      <span className="absolute bottom-3 left-3 rounded bg-background/95 px-2 py-1 text-xs text-foreground">{t("previewSilent")}</span>
    </div>
    {reduced && <p className="text-xs leading-5 text-muted-foreground">{t("reduced")}</p>}
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" name="animationEnabled" className="size-4 accent-primary" checked={value.animationEnabled} onChange={e => onChange({ ...value, animationEnabled: e.target.checked })} />{t("animationEnabled")}
    </label>
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" name="soundEnabled" className="size-4 accent-primary" checked={value.soundEnabled} onChange={e => onChange({ ...value, soundEnabled: e.target.checked })} />{t("soundEnabled")}
    </label>
    <p className="text-xs leading-5 text-muted-foreground">{t("soundHint")}</p>
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-volume`} className="text-sm font-medium">{t("volume")}</label>
        <Input id={`${id}-volume`} name="soundVolume" autoComplete="off" inputMode="numeric" type="number" min={0} max={100} step={1} value={Number.isFinite(value.soundVolume) ? value.soundVolume : ""} className="h-11 w-24"
          aria-invalid={!validVolume} aria-describedby={!validVolume ? `${id}-volume-error` : undefined}
          onChange={e => onChange({ ...value, soundVolume: e.target.value === "" ? NaN : Number(e.target.value) })} />
      </div>
      <input type="range" name="soundVolumeSlider" min={0} max={100} step={1} value={validVolume ? value.soundVolume : 50} aria-label={t("volumeSlider")} className="h-11 w-full accent-primary" onChange={e => onChange({ ...value, soundVolume: Number(e.target.value) })} />
      {!validVolume && <p id={`${id}-volume-error`} role="status" className="text-xs text-destructive">{t("invalidVolume")}</p>}
    </div>
  </div>;
}
