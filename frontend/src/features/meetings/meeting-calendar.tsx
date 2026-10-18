"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { dateKeyOf, todayKey } from "@/features/reminders/dates";
import { meetingsApi } from "./api";
import { meetingKeys, MeetingError, MeetingStatus, useMeetingProject } from "./shared";
import { useSession } from "@/features/auth/hooks/use-session";
import type { Meeting } from "./types";

/** Interval overlap, including meetings crossing local midnight. No reminder copies are created. */
export function meetingsOnDate(meetings: Meeting[], key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const start = new Date(year, month - 1, day).getTime(), end = new Date(year, month - 1, day + 1).getTime();
  return meetings.filter(meeting => Date.parse(meeting.startsAt) < end && Date.parse(meeting.endsAt) > start);
}
export function useMonthMeetings(projectId: string | undefined, month: Date) {
  const { data: user } = useSession();
  const from = new Date(month.getFullYear(), month.getMonth(), 1).toISOString();
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
  return useQuery({ queryKey: [...meetingKeys(user?.id, projectId), "calendar", from, to], enabled: !!projectId && !!user,
    queryFn: ({ signal }) => meetingsApi.calendar(projectId!, from, to, signal), retry: false, refetchInterval: 30_000 });
}
export function MeetingDayList({ meetings, slug }: { meetings: Meeting[]; slug: string }) {
  const t = useTranslations("meetings"), locale = useLocale();
  return <section className="workspace-panel min-w-0 space-y-4 p-5"><h2 className="font-semibold">{t("group")}</h2>{!meetings.length && <p className="text-sm text-muted-foreground">{t("emptyDay")}</p>}
    {meetings.map(meeting => <Link key={meeting.id} href={`/projects/${slug}/meetings/${meeting.id}`} className="flex min-w-0 flex-col gap-2 border-t py-3 hover:text-primary"><span className="break-words text-sm font-medium">{meeting.title}</span><span className="text-xs text-muted-foreground">{new Date(meeting.startsAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })} – {new Date(meeting.endsAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}</span><span><MeetingStatus meeting={meeting} /></span></Link>)}
  </section>;
}
export function MeetingCalendar({ slug }: { slug: string }) {
  const t = useTranslations("meetings"), locale = useLocale(), context = useMeetingProject(slug);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(todayKey);
  const query = useMonthMeetings(context.project?.id, month);
  function move(delta: number) { const next = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(next); setSelected(dateKeyOf(next)); }
  return <div className="space-y-5"><PageHeader title={t("calendar")} description={context.project?.name} action={<Link href={`/projects/${slug}/meetings/new`} className={buttonVariants()}>{t("create")}</Link>} />
    {context.isError || query.isError ? <MeetingError error={context.error ?? query.error} retry={() => void query.refetch()} /> : <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="workspace-panel min-w-0 p-5" aria-busy={query.isFetching}><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold capitalize" aria-live="polite">{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</h2><div className="flex gap-2"><Button variant="outline" onClick={() => move(-1)} aria-label={t("previousMonth")}>‹</Button><Button variant="outline" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(todayKey()); }}>{t("today")}</Button><Button variant="outline" onClick={() => move(1)} aria-label={t("nextMonth")}>›</Button></div></div><MonthGrid month={month} selected={selected} today={todayKey()} byDate={new Map()} meetings={query.data ?? []} deadline={context.project?.targetEndDate ?? null} onSelect={setSelected} />{query.isPending && <p role="status" className="mt-4 text-sm">{t("loading")}</p>}</section><MeetingDayList meetings={meetingsOnDate(query.data ?? [], selected)} slug={slug} /></div>}
  </div>;
}
