"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Lightning, FolderSimple, Clock, CaretLeft, CaretRight, Users, GearSix } from "@phosphor-icons/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/empty-state";
import { projectsApi } from "@/features/projects/api";
import { projectStatusDotClass } from "@/features/projects/status-colors";
import { useSession } from "@/features/auth/hooks/use-session";
import { MonthGrid } from "@/features/calendar/components/month-grid";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import { MyTasksCard } from "@/features/tasks/components/my-tasks-card";
import { ReminderList } from "@/features/reminders/components/reminder-list";
import { dateFromKey, dateKey, todayKey } from "@/features/reminders/dates";
import { useMonthReminders } from "@/features/reminders/hooks/use-month-reminders";
import { cn } from "@/lib/utils";

function MiniCalendar() {
  const t = useTranslations("workspace");
  const tc = useTranslations("calendarPage");
  const locale = useLocale();
  const { data: user } = useSession();
  const { project } = useSelectedProject();
  const { isManager } = useCurrentMember(project?.id ?? "");
  const [today] = useState(() => todayKey());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const reminders = useMonthReminders(project?.id, month);
  const selectedReminders = reminders.byDate.get(selected) ?? [];
  function moveMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(dateKey(next.getFullYear(), next.getMonth(), 1));
  }
  return <section id="calendar" className="scroll-mt-20 border-t pt-5">
    <h2 className="text-sm font-semibold">{t("calendar")}</h2>
    {project && <p className="mb-3 truncate text-xs text-muted-foreground">{project.name}</p>}
    <div className="mb-3 flex items-center justify-between">
      <span className="text-xs font-medium capitalize" aria-live="polite">{month.toLocaleDateString(locale, { month: "long", year: "numeric" })}</span>
      <div className="flex"><Button variant="ghost" size="icon-sm" aria-label={t("previousMonth")} onClick={() => moveMonth(-1)}><CaretLeft size={14} /></Button><Button variant="ghost" size="icon-sm" aria-label={t("nextMonth")} onClick={() => moveMonth(1)}><CaretRight size={14} /></Button></div>
    </div>
    <MonthGrid compact month={month} selected={selected} today={today} byDate={reminders.byDate} deadline={project?.targetEndDate ?? null} onSelect={setSelected} />
    <div className="mt-4 space-y-2 border-t pt-3" aria-live="polite">
      <p className="text-[11px] font-medium">{dateFromKey(selected).toLocaleDateString(locale, { day: "numeric", month: "long" })}</p>
      {project && selectedReminders.length > 0
        ? <ReminderList reminders={selectedReminders} projectId={project.id} currentUserId={user?.id} isManager={isManager} />
        : <p className="text-xs leading-5 text-muted-foreground">{tc("noRemindersForDay")}</p>}
      {reminders.isError && <p role="alert" className="text-xs text-destructive">{tc("loadError")}</p>}
      <Link href="/calendar" className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">{tc("openCalendar")}<ArrowRight size={12} aria-hidden="true" /></Link>
      <p className="text-[10px] leading-4 text-muted-foreground">{t("calendarScope")}</p>
    </div>
  </section>;
}

export function Dashboard() {
  const t = useTranslations("workspace");
  const tp = useTranslations("projects");
  const locale = useLocale();
  const { data: user } = useSession();
  const [today] = useState(() => new Date());
  const [view, setView] = useState<"overview" | "updates">("overview");
  const query = useQuery({ queryKey: ["projects", "dashboard"], queryFn: () => projectsApi.list(0, 6) });
  const projects = query.data?.content ?? [];
  const homes = useQueries({ queries: projects.map(project => ({ queryKey: ["project-home", project.id], queryFn: () => projectsApi.home(project.id) })) });
  const updates = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const create = <Link href="/projects/new" className={buttonVariants()}><Plus size={16} aria-hidden="true" />{t("create")}</Link>;
  const updateList = <section className="min-w-0"><h2 className="mb-4 text-[15px] font-semibold">{t("updates")}</h2><div className="space-y-0">{updates.map(project => <Link key={project.id} href={`/projects/${project.slug}`} className="flex items-start gap-3 border-b py-3 last:border-0 hover:bg-muted/50"><span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border bg-surface-2"><Clock size={14} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{project.name}</span><span className="text-[11px] text-muted-foreground">{t("projectUpdated")}</span></span><time dateTime={project.updatedAt} className="shrink-0 text-[10px] text-muted-foreground">{new Date(project.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}</time></Link>)}{!query.isLoading && !query.isError && !updates.length && <p className="text-xs text-muted-foreground">{t("noUpdates")}</p>}</div></section>;

  return <div className="grid min-h-[calc(100dvh-3.5rem)] xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
    <div className="min-w-0 space-y-6 px-4 py-6 sm:px-7 sm:py-7">
      <div><p className="text-xs text-muted-foreground">{today.toLocaleDateString(locale, { dateStyle: "full" })}</p><h1 className="mt-1.5 text-[26px] leading-tight font-bold tracking-tight break-words sm:text-[32px]">{t("greeting", { name: user?.nickname ?? "" })}</h1><p className="mt-2 text-[13px] text-muted-foreground">{t("subtitle")}</p></div>
      <div className="flex gap-6 border-b" role="tablist" aria-label={t("dashboard")}>
        {(["overview", "updates"] as const).map(tab => <button key={tab} id={`tab-${tab}`} role="tab" aria-selected={view === tab} aria-controls="dashboard-panel" tabIndex={view === tab ? 0 : -1} onClick={() => setView(tab)} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "overview" : event.key === "End" ? "updates" : view === "overview" ? "updates" : "overview"; setView(next); document.getElementById(`tab-${next}`)?.focus(); } }} className={cn("-mb-px border-b-2 border-transparent pb-3 text-xs text-muted-foreground hover:text-foreground", view === tab && "border-primary font-semibold text-foreground")}>{t(tab)}</button>)}
      </div>
      <div id="dashboard-panel" role="tabpanel" aria-labelledby={`tab-${view}`} className="space-y-6">
        {view === "overview" && <>
          <section className="dashboard-hero rounded-lg border p-5 sm:p-6">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded bg-accent px-2 py-1 text-[10px] font-medium"><Lightning size={12} aria-hidden="true" />{t("quickStart")}</span>
            <h2 className="text-xl font-semibold tracking-tight">{t("heroTitle")}</h2><p className="mt-1.5 max-w-lg text-xs leading-5 text-muted-foreground">{t("heroDescription")}</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">{create}<Link href="/organizations" className="inline-flex items-center gap-2 text-xs hover:underline">{t("teams")}<ArrowRight size={14} aria-hidden="true" /></Link></div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-[15px] font-semibold">{t("yourProjects")}</h2><Link href="/projects" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">{t("allProjects")}<ArrowRight size={13} aria-hidden="true" /></Link></div>
            {query.isLoading && <div aria-label={t("loading")} className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
            {query.isError && <div role="alert" className="rounded-lg border p-5"><p className="mb-3 text-sm">{t("loadError")}</p><Button variant="outline" onClick={() => query.refetch()}>{t("retry")}</Button></div>}
            {query.data && !projects.length && <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />}
            {projects.length > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-xs"><caption className="sr-only">{t("yourProjects")}</caption><thead className="border-b bg-surface-2 text-[10px] text-muted-foreground"><tr>{["name", "status", "criteria", "updated", "team"].map(key => <th scope="col" key={key} className="px-3 py-2.5 font-medium whitespace-nowrap">{t(key)}</th>)}</tr></thead><tbody className="divide-y">{projects.map((project, i) => {
              const home = homes[i]?.data;
              const progress = home?.criteriaProgress;
              return <tr key={project.id} className="hover:bg-muted/50"><td className="max-w-60 px-3 py-3"><Link href={`/projects/${project.slug}`} className="flex items-center gap-2.5 hover:underline"><span className="grid size-8 shrink-0 place-items-center rounded-md border bg-muted"><FolderSimple size={17} aria-hidden="true" /></span><span className="min-w-0"><span className="block truncate font-semibold">{project.name}</span><span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{project.description || project.slug}</span></span></Link></td><td className="px-3 py-3 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", projectStatusDotClass(project.status))} />{tp(`overview.statusValues.${project.status}`)}</span></td><td className="min-w-28 px-3 py-3">{progress ? <div className="flex items-center gap-2"><span className="h-1 w-14 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full bg-primary" style={{ width: `${progress.total ? progress.completed / progress.total * 100 : 0}%` }} /></span><span className="text-[10px] text-muted-foreground tabular-nums">{progress.completed}/{progress.total}</span></div> : <span title={t(homes[i]?.isError ? "detailUnavailable" : "loading")}>—</span>}</td><td className="px-3 py-3 text-[10px] whitespace-nowrap text-muted-foreground"><time dateTime={project.updatedAt}>{new Date(project.updatedAt).toLocaleDateString(locale, { day: "numeric", month: "short" })}</time></td><td className="px-3 py-3 text-center tabular-nums">{home?.teamMemberCount ?? "—"}</td></tr>;
            })}</tbody></table></div>}
          </section>
          <div className="grid gap-6 md:grid-cols-2"><MyTasksCard />{updateList}</div>
        </>}
        {view === "updates" && <>{query.isLoading ? <Skeleton className="h-32" /> : query.isError ? <Button variant="outline" onClick={() => query.refetch()}>{t("retry")}</Button> : updateList}<p className="text-xs text-muted-foreground">{t("updatesScope")}</p></>}
      </div>
    </div>
    <aside aria-label={t("insights")} className="min-w-0 space-y-6 border-t bg-surface-2 p-5 xl:border-t-0 xl:border-l">
      <section><h2 className="mb-3 text-sm font-semibold">{t("workspace")}</h2><div className="rounded-lg border bg-card p-4"><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{t("totalProjects")}</span><span className="text-xl font-semibold tabular-nums">{query.data?.totalElements ?? "—"}</span></div><p className="mt-3 border-t pt-3 text-xs leading-5 text-muted-foreground">{t("summaryDescription")}</p></div></section>
      <section><h2 className="mb-2 text-xs font-medium text-muted-foreground">{t("quickActions")}</h2><Link href="/projects/new" className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-xs hover:bg-muted"><Plus size={17} aria-hidden="true" />{t("create")}<ArrowRight className="ml-auto" size={14} aria-hidden="true" /></Link><Link href="/organizations" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs hover:bg-muted"><Users size={17} aria-hidden="true" />{t("teams")}<ArrowRight className="ml-auto" size={14} aria-hidden="true" /></Link><Link href="/account" className="flex items-center gap-3 rounded-md px-3 py-2.5 text-xs hover:bg-muted"><GearSix size={17} aria-hidden="true" />{t("settings")}<ArrowRight className="ml-auto" size={14} aria-hidden="true" /></Link></section>
      <MiniCalendar />
    </aside>
  </div>;
}
