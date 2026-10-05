"use client";

import { useId, useState } from "react";
import Link from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { PageFailure } from "@/features/errors/page-failure";
import { ApiError } from "@/lib/api/client";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton, ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { StatusDot } from "@/features/tasks/components/task-badges";
import { TaskRow } from "@/features/tasks/components/task-row";
import { useTaskFormat } from "@/features/tasks/format";
import { useAllTasks } from "@/features/tasks/hooks";
import { taskPermissions } from "@/features/tasks/permissions";
import { TASK_STATUSES } from "@/features/tasks/types";
import { statusDotClass } from "@/features/tasks/workflow";
import { AdvancedReadOnlyNotice } from "@/features/tasks/components/task-mode-picker";
import { allowsAdvanced } from "@/features/tasks/task-model";
import { cn } from "@/lib/utils";
import { daysLeft, percent } from "../dates";
import { useSprint, useSprints, useSprintSummary } from "../hooks";
import type { Sprint, SprintSummary } from "../types";
import { BurndownChart, type BurndownUnit } from "./burndown-chart";
import { SprintActions } from "./sprint-actions";
import { SprintStatusBadge } from "./sprint-status-badge";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-foreground">{value}</dd>
      {hint && <p className="text-xs text-muted-foreground tabular-nums">{hint}</p>}
    </div>
  );
}

function Stats({ sprint, summary }: { sprint: Sprint; summary: SprintSummary | undefined }) {
  const t = useTranslations("sprints.detail.stats");
  const format = useTaskFormat();
  if (!summary) return <Skeleton className="h-24 w-full rounded-xl" aria-hidden="true" />;

  const left = daysLeft(sprint.endDate);
  const timing =
    sprint.status === "COMPLETED"
      ? sprint.completedAt
        ? t("completedOn", { date: format.dateTime(sprint.completedAt) })
        : t("completed")
      : sprint.status === "PLANNED"
        ? t("notStarted")
        : left < 0
          ? t("overdue", { count: -left })
          : left === 0
            ? t("endsToday")
            : t("daysLeft", { count: left });

  return (
    <dl className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card lg:grid-cols-4 lg:divide-y-0">
      <Stat label={t("tasks")} value={`${summary.doneTasks}/${summary.totalTasks}`} hint={t("percent", { value: percent(summary.doneTasks, summary.totalTasks) })} />
      <Stat label={t("points")} value={`${summary.donePoints}/${summary.totalPoints}`} hint={t("percent", { value: percent(summary.donePoints, summary.totalPoints) })} />
      <Stat label={t("logged")} value={format.duration(summary.loggedMinutes)} />
      <Stat label={t("time")} value={timing} />
    </dl>
  );
}

function StatusBreakdown({ summary }: { summary: SprintSummary | undefined }) {
  const t = useTranslations("sprints.detail.breakdown");
  const tc = useTranslations("tasks.common.status");
  const headingId = useId();
  const total = summary?.totalTasks ?? 0;

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id={headingId} className="text-sm font-semibold text-foreground">
        {t("title")}
      </h2>
      {!summary ? (
        <Skeleton className="h-32 w-full rounded-lg" aria-hidden="true" />
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="space-y-2.5">
          {TASK_STATUSES.map((status) => {
            const count = summary.byStatus[status] ?? 0;
            return (
              <li key={status} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-2 text-foreground">
                    <StatusDot status={status} />
                    {tc(status)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{count}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className={cn("h-full rounded-full", statusDotClass(status))} style={{ width: `${percent(count, total)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function BurndownCard({ sprint, summary }: { sprint: Sprint; summary: SprintSummary | undefined }) {
  const t = useTranslations("sprints.burndown");
  const headingId = useId();
  const [chosen, setChosen] = useState<BurndownUnit | null>(null);
  const unit: BurndownUnit = chosen ?? ((summary?.totalPoints ?? 0) > 0 ? "points" : "tasks");

  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-sm font-semibold text-foreground">
          {t("title")}
        </h2>
        <div role="group" aria-label={t("unit")} className="inline-flex rounded-lg border bg-muted p-0.5">
          {(["points", "tasks"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={unit === item}
              onClick={() => setChosen(item)}
              className={cn(
                "h-6 rounded-md px-2.5 text-xs font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                unit === item ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`units.${item}`)}
            </button>
          ))}
        </div>
      </div>

      {!summary ? (
        <Skeleton className="h-56 w-full rounded-lg" aria-hidden="true" />
      ) : summary.burndown.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <BurndownChart sprint={sprint} points={summary.burndown} totalPoints={summary.totalPoints} totalTasks={summary.totalTasks} unit={unit} />
      )}
    </section>
  );
}

function SprintTasks({ projectId, slug, sprintId, userId, isManager }: { projectId: string; slug: string; sprintId: string; userId: string; isManager: boolean }) {
  const t = useTranslations("sprints.detail.tasks");
  const headingId = useId();
  const tasks = useAllTasks(projectId, { sprintId, sort: "priority", direction: "desc" });

  return (
    <section aria-labelledby={headingId} className="space-y-2.5">
      <h2 id={headingId} className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
        {t("title")}
        {tasks.data && <span className="text-xs font-normal text-muted-foreground tabular-nums">{tasks.data.length}</span>}
      </h2>
      {tasks.isPending ? (
        <Skeleton className="h-32 w-full rounded-xl" aria-hidden="true" />
      ) : tasks.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("error")}
        </p>
      ) : tasks.data.length === 0 ? (
        <p className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {tasks.data.map((task) => (
            <TaskRow key={task.id} task={task} href={`/projects/${slug}/tasks/${task.id}`} canChangeStatus={taskPermissions(task, userId, isManager).work} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SprintDetailBody({ slug, project, projectId, isManager, userId, sprintId }: ProjectGateContext & { sprintId: string }) {
  const t = useTranslations("sprints.detail");
  const router = useRouter();
  const format = useTaskFormat();
  const hintId = useId();
  const sprint = useSprint(projectId, sprintId);
  const summary = useSprintSummary(projectId, sprintId);
  const sprints = useSprints(projectId);

  if (sprint.isPending) return <PageSkeleton />;
  if (sprint.isError || !sprint.data) {
    return <PageFailure error={sprint.error ?? new ApiError(404)} onRetry={() => { void sprint.refetch(); }} />;
  }

  const data = sprint.data;
  const hasOtherActive = (sprints.data ?? []).some((item) => item.status === "ACTIVE" && item.id !== data.id);

  return (
    <article aria-label={data.name} className="space-y-6">
      {!allowsAdvanced(project.taskManagementMode) && <AdvancedReadOnlyNotice />}
      <div className="space-y-4">
        <Link href={`/projects/${slug}/sprints`} className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
          <ArrowLeft size={14} aria-hidden="true" />
          {t("back")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-heading text-2xl font-semibold tracking-tight break-words text-foreground sm:text-3xl">{data.name}</h1>
              <SprintStatusBadge status={data.status} />
            </div>
            <p className="text-sm text-muted-foreground tabular-nums">
              {format.day(data.startDate)} – {format.day(data.endDate)}
            </p>
          </div>
          {isManager && allowsAdvanced(project.taskManagementMode) && data.status !== "COMPLETED" && (
            <div className="space-y-1.5">
              <SprintActions projectId={projectId} sprint={data} size="default" blockedByActive={hasOtherActive} blockedHintId={hintId} onArchived={() => router.push(`/projects/${slug}/sprints`)} />
              {hasOtherActive && data.status === "PLANNED" && (
                <p id={hintId} className="text-xs text-muted-foreground">
                  {t("startBlocked")}
                </p>
              )}
            </div>
          )}
        </div>

        {data.goal && (
          <div className="space-y-1">
            <h2 className="text-xs font-medium text-muted-foreground">{t("goal")}</h2>
            <p className="max-w-3xl text-sm leading-6 break-words whitespace-pre-wrap text-foreground">{data.goal}</p>
          </div>
        )}
      </div>

      <Stats sprint={data} summary={summary.data} />

      {data.status !== "PLANNED" && summary.data && summary.data.totalTasks > 0 && (
        <Progress value={percent(summary.data.doneTasks, summary.data.totalTasks)} aria-label={t("progress", { done: summary.data.doneTasks, total: summary.data.totalTasks })}>
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <BurndownCard sprint={data} summary={summary.data} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <StatusBreakdown summary={summary.data} />
        </div>
      </div>

      <SprintTasks projectId={projectId} slug={slug} sprintId={data.id} userId={userId} isManager={isManager} />
    </article>
  );
}

export function SprintDetailPage({ slug, sprintId }: { slug: string; sprintId: string }) {
  return <ProjectGate slug={slug}>{(context) => <SprintDetailBody {...context} sprintId={sprintId} />}</ProjectGate>;
}
