"use client";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { meetingsApi } from "./api";
import { meetingKeys, MeetingStatus } from "./shared";
import { useSession } from "@/features/auth/hooks/use-session";
import type { Meeting } from "./types";

/** Interval overlap, including meetings crossing local midnight. No reminder copies are created. */
export function meetingsOnDate(meetings: Meeting[], key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime(), end = new Date(year, month - 1, day + 1).getTime();
  return meetings.filter(meeting => Date.parse(meeting.startsAt) < end && Date.parse(meeting.endsAt) > start);
}
/** The signed-in user's meetings of a month (organized or attended, from every project or none): the selected project never narrows them. */
export function useMonthMeetings(month: Date) {
  const { data: user } = useSession();
  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
  return useQuery({ queryKey: [...meetingKeys(user?.id), "calendar", from, to], enabled: !!user,
    queryFn: ({ signal }) => meetingsApi.calendar(from, to, signal), retry: false, refetchInterval: 30_000 });
}
export function MeetingDayList({ meetings }: { meetings: Meeting[] }) {
  const t = useTranslations("meetings"), locale = useLocale();
  return <section className="workspace-panel min-w-0 space-y-4 p-5"><h2 className="font-semibold">{t("group")}</h2>{!meetings.length && <p className="text-sm text-muted-foreground">{t("emptyDay")}</p>}
    {meetings.map(meeting => <Link key={meeting.id} href={`/meetings/${meeting.id}`} className="flex min-w-0 flex-col gap-2 border-t py-3 hover:text-primary"><span className="break-words text-sm font-medium">{meeting.title}</span><span className="text-xs text-muted-foreground">{new Date(meeting.startsAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })} – {new Date(meeting.endsAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span><span><MeetingStatus meeting={meeting} /></span></Link>)}
  </section>;
}
