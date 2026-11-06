export const ANIMATION_PRESETS = ["THUNDERSTORM", "RAIN", "SNOW", "WATER"] as const;
export type AnimationPreset = typeof ANIMATION_PRESETS[number];
export type ThemeAnimation = { animation: AnimationPreset; soundEnabled: boolean; soundVolume: number; animationEnabled: boolean };
export const DEFAULT_THEME_ANIMATION: ThemeAnimation = { animation: "THUNDERSTORM", soundEnabled: false, soundVolume: 50, animationEnabled: true };

export function normalizeThemeAnimation(value: unknown): ThemeAnimation | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (!ANIMATION_PRESETS.includes(v.animation as AnimationPreset) || typeof v.soundEnabled !== "boolean" || typeof v.animationEnabled !== "boolean"
    || typeof v.soundVolume !== "number" || !Number.isInteger(v.soundVolume) || v.soundVolume < 0 || v.soundVolume > 100) return;
  return { animation: v.animation as AnimationPreset, soundEnabled: v.soundEnabled, soundVolume: v.soundVolume, animationEnabled: v.animationEnabled };
}

export function sameThemeAnimation(a: ThemeAnimation, b: ThemeAnimation) {
  return a.animation === b.animation && a.soundEnabled === b.soundEnabled && a.soundVolume === b.soundVolume && a.animationEnabled === b.animationEnabled;
}
