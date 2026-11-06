"use client";

import { useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { SpeakerLow, SpeakerHigh } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { ANIMATION_PRESETS, type ThemeAnimation } from "../theme-animation";

export function AnimatedThemeEditor({ value, onChange }: { value: ThemeAnimation; onChange: (value: ThemeAnimation) => void }) {
  const t = useTranslations("preferences.animation");
  const id = useId();
  const reduced = useReducedMotionPreference();
  const validVolume = Number.isInteger(value.soundVolume) && value.soundVolume >= 0 && value.soundVolume <= 100;
  return <div className="space-y-5" data-animation-editor>
    <fieldset>
      <legend className="mb-3 text-sm font-medium">{t("presets")}</legend>
      <div className="grid grid-cols-2 gap-3">
        {ANIMATION_PRESETS.map(preset => <label key={preset} className="relative cursor-pointer overflow-hidden rounded-lg border border-input p-3 hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:ring-1 has-[:checked]:ring-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ring">
          <div className="theme-preset-art mb-3 h-16 rounded" data-preset={preset} aria-hidden="true">
            <svg viewBox="0 0 200 64" className="size-full" fill="none" stroke="currentColor" strokeWidth="1.5">
              {preset === "FIRE" ? <><path d="M82 56C65 36 90 26 88 9c19 12 12 27 19 29 7-9 9-16 8-21 22 24 21 43-4 44" /><path d="M92 58c-7-12 5-20 8-28 0 13 19 22 8 31" /><path d="m58 28 2-5m81 13 2-6m-20-18 1-5" /></> : preset === "WATER" ? [35, 72, 113, 151, 178].map((x, i) => <g key={x}><circle cx={x} cy={19 + i % 3 * 13} r={4 + i % 3 * 3} /><path d={`M${x - 3} ${17 + i % 3 * 13}q1-3 4-3`} /></g>) : preset === "SNOW" ? [30, 65, 105, 145, 175].map((x, i) => <circle key={x} cx={x} cy={14 + i % 3 * 17} r={2 + i % 2} fill="currentColor" stroke="none" />) : <>
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
    {reduced && <p className="text-xs leading-5 text-muted-foreground">{t("reduced")}</p>}
    <div className="grid grid-cols-2 gap-x-4" data-animation-toggles>
    <label className="flex min-h-11 cursor-pointer items-start gap-2 py-2.5 text-sm leading-5">
      <input type="checkbox" name="animationEnabled" className="mt-0.5 size-4 shrink-0 accent-primary" checked={value.animationEnabled} onChange={e => onChange({ ...value, animationEnabled: e.target.checked })} />{t("animationEnabled")}
    </label>
    <label className="flex min-h-11 cursor-pointer items-start gap-2 py-2.5 text-sm leading-5">
      <input type="checkbox" name="soundEnabled" className="mt-0.5 size-4 shrink-0 accent-primary" checked={value.soundEnabled} onChange={e => onChange({ ...value, soundEnabled: e.target.checked })} />{t("soundEnabled")}
    </label>
    </div>
    <div className="space-y-1 border-t pt-4" data-theme-volume>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={`${id}-volume`} className="text-sm font-medium">{t("volume")}</label>
        <div className="flex items-center gap-0.5 text-sm text-muted-foreground">
        <Input id={`${id}-volume`} name="soundVolume" autoComplete="off" inputMode="numeric" type="number" min={0} max={100} step={1} value={Number.isFinite(value.soundVolume) ? value.soundVolume : ""} className="theme-volume-value h-9 w-14 border-transparent bg-transparent px-1 text-right font-medium text-foreground tabular-nums shadow-none"
          aria-invalid={!validVolume} aria-describedby={!validVolume ? `${id}-volume-error` : undefined}
          onChange={e => onChange({ ...value, soundVolume: e.target.value === "" ? NaN : Number(e.target.value) })} />
          <span aria-hidden="true">%</span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-3">
        <SpeakerLow className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input type="range" name="soundVolumeSlider" min={0} max={100} step={1} value={validVolume ? value.soundVolume : 50} aria-label={t("volumeSlider")}
          className="theme-volume-slider h-11 w-full min-w-0 flex-1 accent-primary" style={{ "--theme-volume-progress": `${validVolume ? value.soundVolume : 50}%` } as CSSProperties}
          onChange={e => onChange({ ...value, soundVolume: Number(e.target.value) })} />
        <SpeakerHigh className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      {!validVolume && <p id={`${id}-volume-error`} role="status" className="text-xs text-destructive">{t("invalidVolume")}</p>}
      <p className="text-xs leading-5 text-muted-foreground">{t("soundHint")}</p>
    </div>
  </div>;
}
