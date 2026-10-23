"use client";
import { useId } from "react";
import { useTranslations } from "next-intl";
import { Briefcase, CalendarDays, ClipboardList, Code, GraduationCap, Laptop, Lightbulb, MessageSquare, Presentation, Target, Users, Video, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEETING_ICONS, type MeetingIconName } from "./types";

const ICONS: Record<MeetingIconName, LucideIcon> = {
  video: Video, users: Users, calendar: CalendarDays, presentation: Presentation, code: Code, laptop: Laptop,
  lightbulb: Lightbulb, target: Target, briefcase: Briefcase, "graduation-cap": GraduationCap, "clipboard-list": ClipboardList, "message-square": MessageSquare,
};
const known = (name: string | undefined): name is MeetingIconName => !!name && name in ICONS;

/** The meeting's own icon; an unknown or missing name (an older meeting) shows the video icon. */
export function MeetingIcon({ name, size = 20, className }: { name?: string; size?: number; className?: string }) {
  const Icon = known(name) ? ICONS[name] : Video;
  return <Icon size={size} aria-hidden="true" className={className} />;
}

/**
 * Icon choice for the create/edit form: a native radio group (arrow keys, Tab, screen readers and touch work as for any radio), each
 * option named by its icon. Only names of the backend allowlist can be chosen.
 */
export function MeetingIconPicker({ value, onChange, disabled }: { value: string; onChange: (name: MeetingIconName) => void; disabled?: boolean }) {
  const t = useTranslations("meetings"), group = useId();
  const current = known(value) ? value : "video";
  return <fieldset className="min-w-0 space-y-2" disabled={disabled}>
    <legend className="text-sm font-medium">{t("iconLabel")}</legend>
    <div role="radiogroup" aria-label={t("iconLabel")} className="grid grid-cols-6 gap-2 sm:flex sm:flex-wrap">
      {MEETING_ICONS.map(name => <label key={name} data-icon-option={name} className={cn("relative grid size-11 cursor-pointer place-items-center rounded-lg border transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        current === name ? "border-meeting bg-meeting text-meeting-foreground" : "bg-surface-2 text-muted-foreground hover:bg-muted hover:text-foreground", disabled && "cursor-not-allowed opacity-50")}>
        <input type="radio" name={group} value={name} checked={current === name} onChange={() => onChange(name)} className="peer absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" />
        <MeetingIcon name={name} size={20} /><span className="sr-only">{t(`icon.${name}`)}</span>
      </label>)}
    </div>
    <p className="text-xs text-muted-foreground">{t("iconHint")}</p>
  </fieldset>;
}
