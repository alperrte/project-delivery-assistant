"use client";

import { useRef, useState, type DragEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSprints } from "@/features/sprints/hooks";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { allowsAdvanced } from "../task-model";
import { tasksApi } from "../api";
import { invalidateTaskViews, tasksKey, useAllTasks } from "../hooks";
import { taskPermissions } from "../permissions";
import type { Task, TaskListParams, TaskStatus } from "../types";
import { canTransition, STATUS_ORDER } from "../workflow";
import { BoardCard } from "./board-card";
import { ProjectGate, type ProjectGateContext } from "./project-gate";
import { StatusDot } from "./task-badges";

const ALL = "all";
const BACKLOG = "backlog";

type DragState = { taskId: string; projectId: string; from: TaskStatus };

/** Cards live in the `all` query of the project, so a status change only has to patch that cache. */
function patchStatus(tasks: Task[] | undefined, taskId: string, status: TaskStatus) {
  return tasks?.map((task) => (task.id === taskId ? { ...task, status } : task));
}

function BoardSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden" aria-hidden="true">
      {STATUS_ORDER.slice(0, 4).map((status) => (
        <div key={status} className="w-72 shrink-0 space-y-2 rounded-xl bg-muted/40 p-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

function BoardView({ slug, project, projectId, userId, isManager }: ProjectGateContext) {
  const t = useTranslations("tasks.board");
  const tc = useTranslations("tasks.common");
  const te = useTranslations("errors");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const advanced = allowsAdvanced(project.taskManagementMode);
  const sprints = useSprints(projectId, undefined, advanced);

  // Without an explicit choice the board shows the active sprint, or every task when none runs.
  const activeSprint = sprints.data?.find((sprint) => sprint.status === "ACTIVE");
  const requested = searchParams.get("sprint");
  const sprintChoice = !advanced ? ALL : requested ?? (sprints.isPending ? null : (activeSprint?.id ?? ALL));
  const onlyMine = searchParams.get("mine") === "1";

  const params: TaskListParams = {
    sort: "priority",
    direction: "desc",
    ...(sprintChoice === BACKLOG ? { backlog: true } : sprintChoice && sprintChoice !== ALL ? { sprintId: sprintChoice } : {}),
    ...(onlyMine && userId ? { assigneeId: userId } : {}),
  };
  const tasks = useAllTasks(projectId, params, sprintChoice !== null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const pending = useRef(new Set<string>());

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  async function move(task: Task, status: TaskStatus) {
    if (task.status === status || pending.current.has(task.id)) return;
    if (!canTransition(task.status, status)) {
      toast.error(te("TASK_INVALID_TRANSITION"));
      return;
    }
    pending.current.add(task.id);
    const key = [...tasksKey(projectId), "all"];
    await queryClient.cancelQueries({ queryKey: key });
    const snapshot = queryClient.getQueriesData<Task[]>({ queryKey: key });
    queryClient.setQueriesData<Task[]>({ queryKey: key }, (current) => patchStatus(current, task.id, status));
    try {
      const updated = await tasksApi.changeStatus(projectId, task.id, status);
      const label = tc(`status.${updated.status}`);
      toast.success(tc("statusChanged", { key: updated.taskKey, status: label }));
      setAnnouncement(tc("statusChanged", { key: updated.taskKey, status: label }));
    } catch (error) {
      for (const [cacheKey, data] of snapshot) queryClient.setQueryData(cacheKey, data);
      toast.error(te(errorKey(error)));
      if (!(error instanceof ApiError)) setAnnouncement(te(errorKey(error)));
    } finally {
      pending.current.delete(task.id);
      void invalidateTaskViews(queryClient, projectId);
    }
  }

  function handleDragStart(event: DragEvent<HTMLLIElement>, task: Task) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", task.id);
    setDrag({ taskId: task.id, projectId: task.projectId, from: task.status });
  }

  function endDrag() {
    setDrag(null);
    setOverColumn(null);
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: TaskStatus) {
    event.preventDefault();
    const dropped = tasks.data?.find((task) => task.id === drag?.taskId);
    endDrag();
    if (dropped) void move(dropped, status);
  }

  const droppable = (status: TaskStatus) => !!drag && drag.from !== status && canTransition(drag.from, status);

  const byStatus = new Map<TaskStatus, Task[]>(STATUS_ORDER.map((status) => [status, []]));
  for (const task of tasks.data ?? []) byStatus.get(task.status)?.push(task);

  const sprintLabel = (value: string) => {
    if (value === ALL) return t("allTasks");
    if (value === BACKLOG) return t("backlog");
    return sprints.data?.find((sprint) => sprint.id === value)?.name ?? t("allTasks");
  };

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label={t("toolbar")}>
        {advanced && <Select value={sprintChoice ?? ALL} onValueChange={(next) => setParam("sprint", next ?? ALL)}>
          <SelectTrigger className="h-8 w-auto min-w-44" aria-label={t("sprint")}>
            <SelectValue>{(value: string) => sprintLabel(value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allTasks")}</SelectItem>
            <SelectItem value={BACKLOG}>{t("backlog")}</SelectItem>
            {sprints.data?.map((sprint) => (
              <SelectItem key={sprint.id} value={sprint.id}>
                {sprint.name}
                <span className="ml-2 text-xs text-muted-foreground">{tc(`sprintStatus.${sprint.status}`)}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>}
        <Button variant={onlyMine ? "secondary" : "outline"} size="lg" aria-pressed={onlyMine} onClick={() => setParam("mine", onlyMine ? null : "1")}>
          {t("onlyMine")}
        </Button>
        {drag && <span className="text-xs text-muted-foreground">{t("dragHint")}</span>}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      {tasks.isError && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{te(errorKey(tasks.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void tasks.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {(tasks.isPending || sprintChoice === null) && !tasks.isError && <BoardSkeleton />}

      {tasks.data && tasks.data.length === 0 && (
        <EmptyState title={t("emptyTitle")} description={onlyMine ? t("emptyMineDescription") : t("emptyDescription")} />
      )}

      {tasks.data && tasks.data.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-8 sm:px-8" tabIndex={-1}>
          <div className="flex min-w-max gap-3">
            {STATUS_ORDER.map((status) => {
              const column = byStatus.get(status) ?? [];
              const accepts = droppable(status);
              return (
                <section
                  key={status}
                  aria-label={t("column", { status: tc(`status.${status}`), count: column.length })}
                  onDragOver={(event) => {
                    if (!accepts) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (overColumn !== status) setOverColumn(status);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverColumn((current) => (current === status ? null : current));
                  }}
                  onDrop={(event) => accepts && handleDrop(event, status)}
                  className={cn(
                    "flex min-h-48 w-72 shrink-0 flex-col rounded-xl bg-muted/40 p-2 transition-[opacity,box-shadow,background-color] duration-200 motion-reduce:transition-none",
                    drag && !accepts && drag.from !== status && "opacity-40",
                    accepts && "ring-1 ring-foreground/15",
                    overColumn === status && accepts && "bg-muted ring-2 ring-ring/60",
                  )}
                >
                  <header className="flex items-center gap-2 px-1.5 pt-1 pb-2">
                    <StatusDot status={status} />
                    <h2 className="text-xs font-semibold text-foreground">{tc(`status.${status}`)}</h2>
                    <span className="text-xs tabular-nums text-muted-foreground">{column.length}</span>
                  </header>
                  {column.length === 0 ? (
                    <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{accepts ? t("dropHere") : t("columnEmpty")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {column.map((task) => (
                        <BoardCard
                          key={task.id}
                          task={task}
                          href={`/projects/${slug}/tasks/${task.id}`}
                          movable={taskPermissions(task, userId, isManager).work}
                          dragging={drag?.taskId === task.id}
                          onMove={(next) => void move(task, next)}
                          onDragStart={(event) => handleDragStart(event, task)}
                          onDragEnd={endDrag}
                        />
                      ))}
                    </ul>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function BoardPage({ slug }: { slug: string }) {
  return <ProjectGate slug={slug}>{(context) => <BoardView {...context} />}</ProjectGate>;
}
