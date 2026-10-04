"use client";

import { useState } from "react";
import Link from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarBlank, CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/hooks/use-session";
import { useCurrentMember } from "@/features/projects/hooks/use-current-member";
import { useSelectedProject } from "@/features/projects/hooks/use-selected-project";
import { dateKey, todayKey } from "@/features/reminders/dates";
import { useMonthReminders } from "@/features/reminders/hooks/use-month-reminders";
import { errorKey } from "@/lib/api/error-message";
import { DayAgenda } from "./components/day-agenda";
import { MonthGrid } from "./components/month-grid";
import { ProjectSwitcher } from "./components/project-switcher";

export function CalendarPage() {
  const t = useTranslations("calendarPage");
  const tw = useTranslations("workspace");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { data: user } = useSession();
  const { slug, project, isError: projectError, isResolving, select } = useSelectedProject();
  const { isManager } = useCurrentMember(project?.id ?? "");
  const [today] = useState(() => todayKey());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const reminders = useMonthReminders(project?.id, month);

  function moveMonth(delta: number) {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(dateKey(next.getFullYear(), next.getMonth(), 1));
  }

  function goToday() {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(today);
  }

  const monthTitle = month.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const hasProject = !!project;
  const waitingForProject = isResolving || (!!slug && !project && !projectError);

  return (
    <div className="min-w-0">
      <PageHeader
        title={tw("calendar")}
        description={t("description")}
        action={
          hasProject && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={goToday}>{t("today")}</Button>
              <Link href={`/calendar/new?date=${selected}`} className={buttonVariants()}>
                <Plus data-icon="inline-start" size={16} aria-hidden="true" />
                {t("create")}
              </Link>
            </div>
          )
        }
      />

      {waitingForProject ? (
        <Skeleton className="h-136 w-full rounded-2xl" />
      ) : !slug ? (
        <EmptyState
          title={t("noProjectTitle")}
          description={t("noProjectDescription")}
          action={<Link href="/projects/new" className={buttonVariants()}>{tw("create")}</Link>}
        />
      ) : (
        <div className="space-y-5">
          <ProjectSwitcher slug={slug} onSelect={select} />

          {!hasProject ? (
            <div role="alert" className="workspace-panel max-w-xl p-6 text-sm text-muted-foreground">{t("projectNotFound")}</div>
          ) : (
            <>
              {reminders.isError && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                  <span className="text-destructive">{t("loadError")} {te(errorKey(reminders.error))}</span>
                  <Button variant="outline" size="sm" onClick={() => void reminders.refetch()}>{tw("retry")}</Button>
                </div>
              )}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <section aria-label={monthTitle} aria-busy={reminders.isFetching} className="workspace-panel min-w-0 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-base font-semibold capitalize" aria-live="polite">
                      <CalendarBlank size={18} className="text-muted-foreground" aria-hidden="true" />
                      {monthTitle}
                    </h2>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" aria-label={tw("previousMonth")} onClick={() => moveMonth(-1)}><CaretLeft size={16} /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={tw("nextMonth")} onClick={() => moveMonth(1)}><CaretRight size={16} /></Button>
                    </div>
                  </div>
                  <MonthGrid
                    month={month}
                    selected={selected}
                    today={today}
                    byDate={reminders.byDate}
                    deadline={project.targetEndDate}
                    onSelect={setSelected}
                  />
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{tw("calendarScope")}</p>
                </section>

                <DayAgenda
                  selected={selected}
                  reminders={reminders.byDate.get(selected) ?? []}
                  projectId={project.id}
                  currentUserId={user?.id}
                  isManager={isManager}
                  isDeadline={project.targetEndDate === selected}
                  actions
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
