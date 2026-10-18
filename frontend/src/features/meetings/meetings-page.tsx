"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Link from "@/i18n/navigation";
import { CalendarDays, Plus, Video } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { meetingsApi } from "./api";
import { MeetingError, MeetingStatus, useMeetingProject } from "./shared";
import type { MeetingStatus as Status } from "./types";

export function MeetingsPage({ slug }: { slug: string }) {
  const t = useTranslations("meetings"), locale = useLocale();
  const context = useMeetingProject(slug);
  const [status, setStatus] = useState<Status | "">(""), [page, setPage] = useState(0);
  const query = useQuery({ queryKey: [...context.keys, "list", status, page], enabled: !!context.project,
    queryFn: ({ signal }) => meetingsApi.list(context.project!.id, page, status || undefined, signal), retry: false, refetchInterval: 15_000 });
  return <div className="min-w-0 space-y-5"><PageHeader title={t("myMeetings")} description={context.project?.name} action={<Link href={`/projects/${slug}/meetings/new`} className={buttonVariants()}><Plus size={16} />{t("create")}</Link>} />
    <nav className="flex flex-wrap gap-2" aria-label={t("filter")}>
      {(["", "SCHEDULED", "OPEN", "ENDED", "CANCELLED"] as const).map(value => <Button key={value} variant={status === value ? "default" : "outline"} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(0); }}>{t(value ? `status.${value}` : "all")}</Button>)}
      <Link href={`/projects/${slug}/meetings/calendar`} className={buttonVariants({ variant: "ghost", className: "ml-auto" })}><CalendarDays size={16} />{t("calendar")}</Link>
    </nav>
    {context.isError ? <MeetingError error={context.error} /> : query.isError ? <MeetingError error={query.error} retry={() => void query.refetch()} /> : query.isPending ? <p role="status" className="workspace-panel p-8 text-muted-foreground">{t("loading")}</p> : !query.data.content.length ? <EmptyState title={t("empty")} description={t("emptyHint")} /> : <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.content.map(meeting => <Link key={meeting.id} href={`/projects/${slug}/meetings/${meeting.id}`} className="workspace-panel flex min-w-0 flex-col gap-4 p-5 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-ring">
        <div className="flex items-center justify-between gap-2"><Video size={20} className="text-primary" /><MeetingStatus meeting={meeting} /></div>
        <h2 className="break-words text-lg font-semibold">{meeting.title}</h2>
        <p className="line-clamp-2 break-words text-sm leading-6 text-muted-foreground">{meeting.description}</p>
        <time dateTime={meeting.startsAt} className="mt-auto border-t pt-4 text-sm tabular-nums">{new Date(meeting.startsAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}</time>
        {meeting.overtime && meeting.status === "OPEN" && <p className="text-xs text-warning">{t("overtime")}</p>}
      </Link>)}</div>
      <nav aria-label={t("pages")} className="flex items-center justify-center gap-4"><Button variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{t("previous")}</Button><span className="text-sm tabular-nums">{page + 1} / {query.data.totalPages}</span><Button variant="outline" disabled={page + 1 >= query.data.totalPages} onClick={() => setPage(p => p + 1)}>{t("next")}</Button></nav>
    </>}
  </div>;
}
