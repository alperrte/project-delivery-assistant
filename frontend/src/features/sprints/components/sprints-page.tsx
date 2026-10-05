"use client";

import { useId, useState } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectGate, type ProjectGateContext } from "@/features/tasks/components/project-gate";
import { useTaskFormat } from "@/features/tasks/format";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { daysLeft, percent } from "../dates";
import { useSprints, useSprintSummary } from "../hooks";
import type { Sprint, SprintStatus } from "../types";
import { SprintActions } from "./sprint-actions";
import { SprintDialog } from "./sprint-dialog";
import { SprintStatusBadge } from "./sprint-status-badge";

const SECTIONS: SprintStatus[] = ["ACTIVE", "PLANNED", "COMPLETED"];

function byStatus(status: SprintStatus, sprints: Sprint[]): Sprint[] {
  const items = sprints.filter((sprint) => sprint.status === status);
  if (status === "COMPLETED") return items.sort((a, b) => b.endDate.localeCompare(a.endDate));
  return items.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Tasks and points done so far, for the running sprint only (one summary request per row stays cheap). */
function ActiveProgress({ projectId, sprint }: { projectId: string; sprint: Sprint }) {
  const t = useTranslations("sprints.row");
  const summary = useSprintSummary(projectId, sprint.id);
  if (!summary.data) return <Skeleton className="h-8 w-full rounded-md md:w-56" aria-hidden="true" />;
  const { doneTasks, totalTasks, donePoints, totalPoints } = summary.data;
  const value = percent(doneTasks, totalTasks);
  return (
    <div className="w-full space-y-1.5 md:w-56">
      <Progress value={value} aria-label={t("progress", { done: doneTasks, total: totalTasks })}>
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>
      <p className="flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{t("progress", { done: doneTasks, total: totalTasks })}</span>
        {totalPoints > 0 && <span>{t("points", { done: donePoints, total: totalPoints })}</span>}
      </p>
    </div>
  );
}

function SprintRow({ slug, projectId, sprint, isManager, blockedByActive, blockedHintId }: { slug: string; projectId: string; sprint: Sprint; isManager: boolean; blockedByActive: boolean; blockedHintId: string }) {
  const t = useTranslations("sprints.row");
  const format = useTaskFormat();
  const left = sprint.status === "ACTIVE" ? daysLeft(sprint.endDate) : null;

  return (
    <li className="group/row relative flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50 md:flex-row md:items-center md:gap-5">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/projects/${slug}/sprints/${sprint.id}`}
            className="min-w-0 truncate rounded-sm text-sm font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {sprint.name}
          </Link>
          <SprintStatusBadge status={sprint.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground tabular-nums">
          <span>
            {format.day(sprint.startDate)} – {format.day(sprint.endDate)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t("tasks", { count: sprint.taskCount })}</span>
          {left !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className={cn(left < 0 && "font-medium text-destructive")}>
                {left < 0 ? t("overdue", { count: -left }) : left === 0 ? t("endsToday") : t("daysLeft", { count: left })}
              </span>
            </>
          )}
        </p>
        {sprint.goal && <p className="line-clamp-2 text-xs leading-5 break-words text-muted-foreground">{sprint.goal}</p>}
      </div>

      {sprint.status === "ACTIVE" && <ActiveProgress projectId={projectId} sprint={sprint} />}

      {isManager && sprint.status !== "COMPLETED" && (
        <div className="relative z-10 md:shrink-0">
          <SprintActions projectId={projectId} sprint={sprint} blockedByActive={blockedByActive} blockedHintId={blockedHintId} />
        </div>
      )}
    </li>
  );
}

function SprintsView({ slug, projectId, isManager }: ProjectGateContext) {
  const t = useTranslations("sprints");
  const te = useTranslations("errors");
  const hintId = useId();
  const [creating, setCreating] = useState(false);
  const sprints = useSprints(projectId);

  const list = sprints.data ?? [];
  const hasActive = list.some((sprint) => sprint.status === "ACTIVE");
  const createButton = isManager && (
    <Button onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" />
      {t("create")}
    </Button>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} action={createButton || undefined} />

      {sprints.isError && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{te(errorKey(sprints.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void sprints.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {sprints.isPending && (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {sprints.data && list.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={isManager ? t("emptyManagerDescription") : t("emptyMemberDescription")} action={createButton || undefined} />
      )}

      {sprints.data && list.length > 0 && (
        <div className="space-y-8">
          {SECTIONS.map((status) => {
            const items = byStatus(status, list);
            if (items.length === 0) return null;
            const headingId = `sprints-${status}`;
            return (
              <section key={status} aria-labelledby={headingId} className="space-y-2.5">
                <h2 id={headingId} className="flex items-baseline gap-2 text-sm font-semibold text-foreground">
                  {t(`sections.${status}`)}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">{items.length}</span>
                </h2>
                {status === "PLANNED" && hasActive && isManager && (
                  <p id={hintId} className="text-xs text-muted-foreground">
                    {t("startBlocked")}
                  </p>
                )}
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {items.map((sprint) => (
                    <SprintRow key={sprint.id} slug={slug} projectId={projectId} sprint={sprint} isManager={isManager} blockedByActive={hasActive} blockedHintId={hintId} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <SprintDialog projectId={projectId} open={creating} onOpenChange={setCreating} />
    </div>
  );
}

export function SprintsPage({ slug }: { slug: string }) {
  return <ProjectGate slug={slug}>{(context) => <SprintsView {...context} />}</ProjectGate>;
}
