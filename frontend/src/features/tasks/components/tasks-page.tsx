"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CaretDown, Plus } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { TASK_PAGE_SIZE } from "../api";
import { activeFilterCount, toListParams, useTaskFilters } from "../filters";
import { groupTasks, type TaskGroup } from "../grouping";
import { useAllTasks, useTaskList } from "../hooks";
import { taskPermissions } from "../permissions";
import type { Task } from "../types";
import { ProjectGate, type ProjectGateContext } from "./project-gate";
import { TaskFilterBar } from "./task-filter-bar";
import { TaskRow } from "./task-row";
import { StatusBadge } from "./task-badges";

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
        {group.userId && <Avatar name={group.name ?? "?"} className="size-5 bg-muted text-[9px] text-foreground" />}
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

function GroupedList({ groups, row }: { groups: TaskGroup[]; row: (task: Task, group: TaskGroup) => ReactNode }) {
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
          <section key={group.id} aria-label={t("groupCount", { count: group.tasks.length })} className="overflow-hidden rounded-xl border bg-card">
            <h2 className="m-0">
              <button
                type="button"
                aria-expanded={open}
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center gap-2 bg-muted/40 px-3 py-2 text-left outline-none transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <CaretDown size={12} weight="bold" aria-hidden="true" className={cn("text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", !open && "-rotate-90")} />
                <GroupHeading group={group} />
                <span className="text-xs tabular-nums text-muted-foreground">{group.tasks.length}</span>
              </button>
            </h2>
            {open && <ul className="divide-y border-t">{group.tasks.map((task) => row(task, group))}</ul>}
          </section>
        );
      })}
    </div>
  );
}

function TasksView({ slug, projectId, isManager, userId }: ProjectGateContext) {
  const t = useTranslations("tasks.list");
  const te = useTranslations("errors");
  const { filters, update, reset } = useTaskFilters();
  const grouped = filters.group !== "none";
  const params = toListParams(filters, userId);
  const filtered = activeFilterCount(filters) > 0;

  // Grouping needs every match at once; the flat list pages on the server.
  const paged = useTaskList(grouped ? "" : projectId, { ...params, page: filters.page, size: TASK_PAGE_SIZE });
  const all = useAllTasks(projectId, params, grouped);
  const query = grouped ? all : paged;

  const tasks = grouped ? (all.data ?? []) : (paged.data?.content ?? []);
  const total = grouped ? tasks.length : (paged.data?.totalElements ?? 0);
  const totalPages = paged.data?.totalPages ?? 1;

  const renderRow = (task: Task, group?: TaskGroup) => (
    <TaskRow
      key={group ? `${group.id}:${task.id}` : task.id}
      task={task}
      href={`/projects/${slug}/tasks/${task.id}`}
      canChangeStatus={taskPermissions(task, userId, isManager).work}
    />
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
      <TaskFilterBar projectId={projectId} filters={filters} onChange={update} onReset={reset} />

      {query.isError && (
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
          ) : grouped ? (
            <GroupedList groups={groupTasks(tasks, filters.group as Exclude<typeof filters.group, "none">)} row={renderRow} />
          ) : (
            <>
              <ul className={cn("divide-y overflow-hidden rounded-xl border bg-card transition-opacity", query.isFetching && "opacity-70")}>
                {tasks.map((task) => renderRow(task))}
              </ul>
              <PaginationBar
                page={Math.min(filters.page, totalPages - 1)}
                totalPages={totalPages}
                totalElements={total}
                pageSize={TASK_PAGE_SIZE}
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
