"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/features/auth/hooks/use-session";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { meetingsApi } from "./api";
import type { Meeting, MeetingPerson } from "./types";

/** Meetings are scoped to the signed-in account only. The selected project, the route and a project change never enter a meeting query key. */
export const meetingKeys = (actor: string | undefined) => ["accounts", actor, "meetings"] as const;
/** The signed-in account that owns every meeting query. */
export function useMeetingAccount() {
  const { data: user } = useSession();
  return { user, keys: meetingKeys(user?.id) };
}
export function useMeeting(id: string) {
  const context = useMeetingAccount();
  const query = useQuery({
    queryKey: [...context.keys, id], enabled: !!context.user,
    queryFn: ({ signal }) => meetingsApi.detail(id, signal),
    refetchInterval: 10_000, retry: false,
  });
  return { ...context, query };
}
/** The organizer and every attendee as display profiles (the organizer first), each once. */
export const meetingProfiles = (meeting: Pick<Meeting, "organizer" | "attendees">): MeetingPerson[] => [...(meeting.organizer ? [meeting.organizer] : []), ...meeting.attendees];
/** The current time, refreshed on an interval, for countdowns that must not each own a timer. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), intervalMs); return () => clearInterval(timer); }, [intervalMs]);
  return now;
}
export function meetingErrorKey(error: unknown): string {
  // A device or screen-share failure from the browser says what happened instead of the generic "could not complete".
  if (error instanceof Error && !(error instanceof ApiError)) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") return "permissionDenied";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "deviceMissing";
    if (error.name === "NotReadableError" || error.name === "AbortError") return "deviceBusy";
    return "error";
  }
  if (!(error instanceof ApiError)) return "error";
  if (error.code === "MEETING_DUPLICATE_TAB") return "duplicateTab";
  if (error.code === "MEETING_INVITE_INVALID") return "invalidInvite";
  if (error.code === "MEETING_INVALID_SCHEDULE") return "invalidSchedule";
  if (error.status === 403) return error.code === "MEETING_PARTICIPANT_REVOKED" ? "removed" : "forbidden";
  if (error.status === 401) return "sessionExpired";
  if (error.status === 404) return "notFound";
  if (error.status === 429) return "rateLimit";
  if (error.code === "MEETING_RECONNECT_PENDING") return "rotationPending";
  if (error.status === 503) return "unavailable";
  if (error.status === 409) return "closed";
  if (error.status === 400) return "invalid";
  return "error";
}
export function MeetingError({ error, retry }: { error: unknown; retry?: () => void }) {
  const t = useTranslations("meetings");
  return <div role="alert" className="workspace-panel space-y-3 p-5 text-sm"><p className="text-destructive">{t(meetingErrorKey(error))}</p>{retry && <Button variant="outline" onClick={retry}>{t("retry")}</Button>}</div>;
}
const STATUS_TONE: Record<Meeting["status"], string> = {
  SCHEDULED: "bg-meeting-soft text-meeting-ink",
  OPEN: "bg-success/15 text-success",
  ENDED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};
/** Status as a text badge; the label always carries the meaning, the colour only reinforces it. */
export function MeetingStatus({ meeting, className }: { meeting: Pick<Meeting, "status">; className?: string }) {
  const t = useTranslations("meetings");
  return <span data-meeting-status={meeting.status} className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[meeting.status], className)}>
    {meeting.status === "OPEN" && <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}{t(`status.${meeting.status}`)}
  </span>;
}
export { joinLocal, localDateTime, splitLocal } from "./meeting-schedule";
/** Length of a meeting in whole minutes. */
export const durationMinutes = (meeting: Pick<Meeting, "startsAt" | "endsAt">) => Math.max(0, Math.round((Date.parse(meeting.endsAt) - Date.parse(meeting.startsAt)) / 60_000));
/** People on a meeting: its organizer plus the planned attendees, each counted once. */
export const meetingPeople = (meeting: Pick<Meeting, "organizerId" | "attendeeIds">) => [...new Set([meeting.organizerId, ...meeting.attendeeIds])];
/** `hh:mm:ss` for a number of seconds. */
export function clockText(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds)), pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
}
