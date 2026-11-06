"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useReducedMotionPreference } from "@/lib/preferences/motion";
import { useSavedPreferences } from "../session-preferences";
import { AmbientAudio } from "./ambient-audio";
import { ThemeScene } from "./theme-scene";

function subscribeVisibility(change: () => void) {
  document.addEventListener("visibilitychange", change);
  return () => document.removeEventListener("visibilitychange", change);
}
export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => document.visibilityState === "visible", () => false);
}

export function ThemeEffects({ userId }: { userId: string | undefined }) {
  const t = useTranslations("preferences.animation");
  const { data } = useSavedPreferences(userId);
  const [audio] = useState(() => new AmbientAudio());
  const state = useSyncExternalStore(audio.subscribe, audio.snapshot, () => "idle" as const);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotionPreference();
  const visible = usePageVisible();
  const active = !!userId && data?.themeColors.themeType === "ANIMATED";
  const animation = data?.themeAnimation;
  const allowed = active && !!animation?.soundEnabled && visible;
  const running = !!animation?.animationEnabled && !reduced && !paused && visible;

  useEffect(() => {
    if (allowed && animation) audio.update(animation.animation, animation.soundVolume);
    else audio.stop();
  }, [audio, allowed, animation]);
  useEffect(() => () => audio.stop(), [audio]);
  useEffect(() => {
    if (!allowed || running || state !== "playing" || animation?.animation !== "THUNDERSTORM") return;
    let timer: ReturnType<typeof setTimeout>;
    const rumble = () => { audio.thunder(); timer = setTimeout(rumble, 18_000 + Math.random() * 14_000); };
    timer = setTimeout(rumble, 12_000 + Math.random() * 4000);
    return () => clearTimeout(timer);
  }, [allowed, running, state, animation?.animation, audio]);

  if (!active || !animation) return null;
  return <>
    <div className="workspace-theme-effects" data-theme-effects>
      <ThemeScene preset={animation.animation} running={running} onLightning={audio.thunder} />
    </div>
    {(animation.soundEnabled || (animation.animationEnabled && !reduced)) && <div data-theme-controls className="theme-session-controls flex flex-wrap items-center gap-2 rounded-lg border bg-background p-2 shadow-sm" aria-label={t("controls")} role="group">
      {animation.animationEnabled && !reduced && <Button type="button" variant="outline" size="sm" className="min-h-11" aria-pressed={paused} onClick={() => setPaused(!paused)}>{paused ? t("resume") : t("pause")}</Button>}
      {animation.soundEnabled && <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={state === "starting"}
        onClick={() => { if (state === "playing") audio.stop(); else void audio.play(animation.animation, animation.soundVolume); }}>
        {state === "playing" ? t("stopSound") : t("startSound")}
      </Button>}
      {state === "blocked" && <span className="max-w-48 text-xs text-muted-foreground" role="status">{t("blocked")}</span>}
    </div>}
  </>;
}
