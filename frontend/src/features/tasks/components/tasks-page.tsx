"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CaretDown, Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { EntityGrid } from "@/components/common/entity-card";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Avatar } from "@/components/ui/avatar";
import { profilePhotoSrc } from "@/features/account/api";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { TASK_LIST_PAGE_SIZE } from "../api";
import { activeFilterCount, toListParams, useTaskFilters } from "../filters";
import { groupTasks, type TaskGroup } from "../grouping";
import { useTaskList } from "../hooks";
import { taskPermissions } from "../permissions";
import { allowsAdvanced } from "../task-model";
import type { Task } from "../types";
import { useTaskView } from "../use-task-view";
import { MyTaskCard } from "./my-task-card";
import { ProjectGate, type ProjectGateContext } from "./project-gate";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskTable } from "./task-table";
import { TaskViewToggle } from "./task-view-toggle";
import { StatusBadge } from "./task-badges";
import { hasBlockingError } from "@/lib/api/live-sync";

export function TaskListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
          <Skeleton className="size-6 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

function GroupHeading({ group }: { group: TaskGroup }) {
  const tc = useTranslations("tasks.common");
  const t = useTranslations("tasks.filters");
  if (group.kind === "status") return <StatusBadge status={group.status} />;
  if (group.kind === "assignee") {
    return (
      <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
        {group.userId && <Avatar name={group.name ?? "?"} src={profilePhotoSrc(group.userId, group.profilePhotoVersion)} className="size-5 bg-muted text-[9px] text-foreground" />}
        {group.userId ? (group.name ?? "?") : tc("unassigned")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
      {group.sprintId ? group.name : t("backlog")}
      {group.status && <span className="text-xs font-normal text-muted-foreground">{tc(`sprintStatus.${group.status}`)}</span>}
    </span>
  );
}

function GroupedList({ groups, body }: { groups: TaskGroup[]; body: (tasks: Task[]) => ReactNode }) {
  const t = useTranslations("tasks.list");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggleGroup(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const open = !collapsed.has(group.id);
        return (
          <section key={group.id} aria-label={t("groupCount", { count: group.tasks.length })} className="space-y-3">
            <h2 className="m-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CaretDown size={12} weight="bold" aria-hidden="true" className={cn("text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")} />
                <GroupHeading group={group} />
                <span className="text-xs tabular-nums text-muted-foreground">{group.tasks.length}</span>
              </button>
            </h2>
            {open && body(group.tasks)}
          </section>
        );
      })}
    </div>
  );
}

function TasksView({ slug, project, projectId, isManager, userId }: ProjectGateContext) {
  const t = useTranslations("tasks.list");
  const te = useTranslations("errors");
  const { filters, update, reset, ready } = useTaskFilters(userId);
  const grouped = filters.group !== "none";
  const { view, setView } = useTaskView("tasks", "table");
  const params = toListParams(filters);
  const filtered = activeFilterCount(filters) > 0;

  // The remembered sort is read before the first request, so the list is never fetched in an order that is about to change.
  const query = useTaskList(projectId, { ...params, page: filters.page, size: TASK_LIST_PAGE_SIZE }, ready);
  const tasks = query.data?.content ?? [];
  const total = query.data?.totalElements ?? 0;
  const totalPages = query.data?.totalPages ?? 1;

  useEffect(() => {
    if (query.data && !query.isPlaceholderData && filters.page > 0 && filters.page >= query.data.totalPages) {
      update({ page: Math.max(0, query.data.totalPages - 1) });
    }
  }, [query.data, query.isPlaceholderData, filters.page, update]);

  const hrefOf = (task: Task) => `/projects/${slug}/tasks/${task.id}`;
  const canChange = (task: Task) => taskPermissions(task, userId, isManager).work;
  const list = (items: Task[]) => view === "grid" ? (
    <EntityGrid>
      {items.map((task) => <MyTaskCard key={task.id} task={task} canChange={canChange(task)} href={hrefOf(task)} showProject={false} progress={false} />)}
    </EntityGrid>
  ) : (
    <TaskTable tasks={items} label={t("title")} canChange={canChange} hrefOf={hrefOf} />
  );

  const createLink = isManager && (
    <Link href={`/projects/${slug}/tasks/new`} className={buttonVariants()}>
      <Plus data-icon="inline-start" size={16} aria-hidden="true" />
      {t("create")}
    </Link>
  );

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} action={createLink || undefined} />
      <TaskFilterBar advanced={allowsAdvanced(project.taskManagementMode)} projectId={projectId} filters={filters} onChange={update} onReset={reset} trailing={<TaskViewToggle view={view} onChange={setView} />} />

      {hasBlockingError(query) && (
        <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{te(errorKey(query.error))}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {query.isPending && !query.isError && <TaskListSkeleton />}

      {query.data && (
        <>
          <p aria-live="polite" className="mb-2 text-xs tabular-nums text-muted-foreground">
            {t("count", { count: total })}
          </p>

          {tasks.length === 0 ? (
            filtered ? (
              <EmptyState
                title={t("noMatchTitle")}
                description={t("noMatchDescription")}
                action={
                  <Button variant="outline" onClick={reset}>
                    {t("clearFilters")}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={t("emptyTitle")} description={isManager ? t("emptyDescription") : t("emptyViewerDescription")} action={createLink || undefined} />
            )
          ) : (
            <>
              <div className={cn("transition-opacity", query.isFetching && "opacity-70")}>
                {grouped ? <GroupedList groups={groupTasks(tasks, filters.group as Exclude<typeof filters.group, "none">)} body={list} /> : list(tasks)}
              </div>
              <PaginationBar
                page={Math.min(filters.page, totalPages - 1)}
                totalPages={totalPages}
                totalElements={total}
                pageSize={TASK_LIST_PAGE_SIZE}
                onPageChange={(page) => {
                  update({ page });
                  window.scrollTo({ top: 0 });
                }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

export function TasksPage({ slug }: { slug: string }) {
  return <ProjectGate slug={slug}>{(context) => <TasksView {...context} />}</ProjectGate>;
}
