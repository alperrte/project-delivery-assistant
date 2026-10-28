"use client";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Ban, CalendarClock, Clock, Copy, Eye, MoreHorizontal, Pencil, PhoneOff } from "lucide-react";
import Link from "@/i18n/navigation";
import { localizeHref } from "@/i18n/routing";
import type { Locale } from "@/i18n/config";
import { AvatarStack } from "@/components/common/avatar-stack";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { buttonVariants, Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clockText, durationMinutes, meetingProfiles, MeetingStatus } from "./shared";
import { isInCallPhase, useOptionalMeetingSession } from "./session/meeting-session";
import { MeetingIcon } from "./meeting-icons";
import { MeetingKindBadge, ProjectChip } from "./meeting-kind";
import type { Meeting } from "./types";

/** "1 sa 30 dk" / "45 dk" from a number of minutes. */
export function DurationText({ minutes }: { minutes: number }) {
  const t = useTranslations("meetings");
  const hours = Math.floor(minutes / 60), rest = minutes % 60;
  return <>{hours && rest ? t("durationHoursMinutes", { hours, minutes: rest }) : hours ? t("durationHours", { hours }) : t("durationMinutes", { minutes: rest })}</>;
}

/** What the live meeting row shows on the right: how long it has been running and what is left of the plan. */
function LiveTiming({ meeting, now }: { meeting: Meeting; now: number }) {
  const t = useTranslations("meetings");
  const elapsed = (now - Date.parse(meeting.openedAt ?? meeting.startsAt)) / 1000, left = Math.ceil((Date.parse(meeting.endsAt) - now) / 60_000);
  return <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground tabular-nums">
    <span className="text-success">{t("liveFor", { time: clockText(elapsed).slice(0, 5) })}</span>
    {left > 0 ? <span>{t("remaining", { minutes: left })}</span> : <span className="text-warning">{t("overtimeShort")}</span>}
  </p>;
}

export type MeetingCardProps = {
  meeting: Meeting; now: number;
  canEdit: boolean; canEnd: boolean;
  onAction: (meeting: Meeting, action: "cancel" | "end") => Promise<void>;
};

/**
 * One meeting as a compact horizontal row: icon, title/status/people count on the left, the people in the middle, the time and the
 * state-dependent action on the right. The title link is stretched over the card (like the project cards); the action button
 * and the menu sit above it. On phones the four parts stack.
 */
export function MeetingCard({ meeting, now, canEdit, canEnd, onAction }: MeetingCardProps) {
  const t = useTranslations("meetings"), locale = useLocale() as Locale;
  const [confirm, setConfirm] = useState<"cancel" | "end" | null>(null);
  const session = useOptionalMeetingSession();
  const callLive = !!session?.live && isInCallPhase(session.live.phase);
  const inThisCall = callLive && session?.target?.id === meeting.id, inOtherCall = callLive && !inThisCall;
  const live = meeting.status === "OPEN", scheduled = meeting.status === "SCHEDULED";
  const detailHref = `/meetings/${meeting.id}`, roomHref = `${detailHref}/room`;
  const shown = meetingProfiles(meeting), peopleCount = new Set([meeting.organizerId, ...meeting.attendeeIds]).size;
  const starts = new Date(meeting.startsAt), ends = new Date(meeting.endsAt);
  const dateText = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(starts);
  const timeFormat = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const canCancel = scheduled && canEdit, canEditMeeting = scheduled && canEdit, canEndAll = live && canEnd;
  async function copyLink() {
    try { await navigator.clipboard.writeText(`${window.location.origin}${localizeHref(detailHref, locale)}`); toast.success(t("linkCopied")); }
    catch { toast.error(t("linkCopyFailed")); }
  }
  return <article data-meeting-card data-status={meeting.status}
    className={cn("relative rounded-xl border bg-card transition-colors hover:bg-muted/40 focus-within:ring-2 focus-within:ring-ring", live && "border-meeting ring-1 ring-meeting")}>
    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.6fr)_auto_minmax(11rem,1fr)_auto] md:items-center md:gap-6">
      <div className="flex min-w-0 items-start gap-3">
        <span aria-hidden="true" data-meeting-icon={meeting.icon} className={cn("grid size-11 shrink-0 place-items-center rounded-lg", live ? "bg-meeting text-meeting-foreground" : "bg-meeting-soft text-meeting-ink")}><MeetingIcon name={meeting.icon} size={20} /></span>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <h3 className="min-w-0 break-words text-base font-semibold leading-6">
              <Link href={detailHref} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring">{meeting.title}</Link>
            </h3>
            <MeetingStatus meeting={meeting} /><span className="sr-only">. </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <MeetingKindBadge meeting={meeting} />
            {meeting.project && <><ProjectChip project={meeting.project} className="text-muted-foreground" /><span className="sr-only">. </span></>}
            <span className="break-words text-sm text-muted-foreground">{t("participantCount", { count: peopleCount })}</span>
          </div>
        </div>
      </div>
      <div className="md:justify-self-center" title={shown.map(member => member.nickname).filter(Boolean).join(", ")}>
        {shown.length > 0 && <AvatarStack people={shown} total={peopleCount} />}
      </div>
      <div className="min-w-0 space-y-1 text-sm">
        <p className="flex items-center gap-2 font-medium tabular-nums"><CalendarClock size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" /><time dateTime={meeting.startsAt}>{dateText}</time></p>
        <p className="flex items-center gap-2 text-muted-foreground tabular-nums"><Clock size={15} aria-hidden="true" className="shrink-0" />
          <span><time dateTime={meeting.startsAt}>{timeFormat.format(starts)}</time> – <time dateTime={meeting.endsAt}>{timeFormat.format(ends)}</time> · <DurationText minutes={durationMinutes(meeting)} /></span></p>
        {live && <LiveTiming meeting={meeting} now={now} />}
      </div>
      <div className="relative z-10 flex items-center justify-between gap-2 md:justify-end">
        {live && !inOtherCall
          // Entering a room needs a full document load (media CSP / Permissions-Policy are per document); a call already running in this tab is resumed in place.
          ? inThisCall
            ? <Link href={roomHref} className={buttonVariants({ variant: "default", className: "min-h-11 md:min-h-9" })}>{t("returnToMeeting")}<span className="sr-only"> — {meeting.title}</span></Link>
            : <a href={localizeHref(roomHref, locale)} className={buttonVariants({ variant: "default", className: "min-h-11 md:min-h-9" })}>{t("joinShort")}<span className="sr-only"> — {meeting.title}</span></a>
          : <Link href={detailHref} className={buttonVariants({ variant: "outline", className: "min-h-11 border-border-strong md:min-h-9" })}>{t("details")}<span className="sr-only"> — {meeting.title}</span></Link>}
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="size-11 md:size-9" aria-label={t("cardActions", { title: meeting.title })} />}><MoreHorizontal size={18} aria-hidden="true" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuItem className="min-h-10" render={<Link href={detailHref} />}><Eye aria-hidden="true" />{t("viewDetails")}</DropdownMenuItem>
            {canEditMeeting && <DropdownMenuItem className="min-h-10" render={<Link href={`${detailHref}/edit`} />}><Pencil aria-hidden="true" />{t("edit")}</DropdownMenuItem>}
            <DropdownMenuItem className="min-h-10" onClick={() => void copyLink()}><Copy aria-hidden="true" />{t("copyMeetingLink")}</DropdownMenuItem>
            {(canCancel || canEndAll) && <DropdownMenuSeparator />}
            {canCancel && <DropdownMenuItem className="min-h-10" variant="destructive" onClick={() => setConfirm("cancel")}><Ban aria-hidden="true" />{t("cancelMeeting")}</DropdownMenuItem>}
            {canEndAll && <DropdownMenuItem className="min-h-10" variant="destructive" onClick={() => setConfirm("end")}><PhoneOff aria-hidden="true" />{t("endForAll")}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    {canCancel && <ConfirmDialog open={confirm === "cancel"} onOpenChange={open => { if (!open) setConfirm(null); }} title={t("cancelMeeting")} description={t("cancelDescription")} confirmLabel={t("confirm")} cancelLabel={t("cancel")} destructive onConfirm={() => onAction(meeting, "cancel")} />}
    {canEndAll && <ConfirmDialog open={confirm === "end"} onOpenChange={open => { if (!open) setConfirm(null); }} title={t("endTitle")} description={t("endConfirm")} confirmLabel={t("endConfirmLabel")} cancelLabel={t("endCancel")} destructive onConfirm={() => onAction(meeting, "end")} />}
  </article>;
}
