"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { X } from "@phosphor-icons/react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/features/auth/hooks/use-session";
import { projectsApi } from "@/features/projects/api";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { TASK_PAGE_SIZE } from "../api";
import { deadlineBucket, type DeadlineBucket } from "../deadline";
import { useMyTaskCounts, useMyTasks, usePoolTasks } from "../hooks";
import { activeMyFilterCount, MY_TABS, toMyTasksParams, useMyTaskFilters, type MyTab } from "../my-filters";
import { taskPermissions } from "../permissions";
import { TASK_STATUSES, type MyTaskCounts, type Task, type TaskStatus } from "../types";
import { PoolCard } from "./pool-card";
import { FilterButton, toggle } from "./task-filter-bar";
import { StatusDot } from "./task-badges";
import { TaskRow } from "./task-row";

const BUCKETS: DeadlineBucket[] = ["overdue", "today", "week", "later", "none"];
const TRIGGER = buttonVariants({ variant: "outline", size: "sm", className: "max-md:h-9" });

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: "danger" | "warning" }) {
  return (
    <div className="space-y-1 px-4 py-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={cn("text-xl font-semibold tabular-nums text-foreground", value ? (tone === "danger" ? "text-destructive" : "") : "text-muted-foreground")}>
        {value ?? <span aria-hidden="true">-</span>}
      </dd>
    </div>
  );
}

/** The five numbers the backend keeps for the signed-in user; `dueSoon` is the 24 hour reminder window. */
function Summary({ counts }: { counts: MyTaskCounts | undefined }) {
  const t = useTranslations("tasks.my.summary");
  return (
    <dl aria-label={t("label")} className="mb-5 grid grid-cols-2 divide-x divide-y overflow-hidden rounded-xl border bg-card sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
      <Stat label={t("open")} value={counts?.open} />
      <Stat label={t("overdue")} value={counts?.overdue} tone="danger" />
      <Stat label={t("dueSoon")} value={counts?.dueSoon} />
      <Stat label={t("blocked")} value={counts?.blocked} />
      <Stat label={t("pool")} value={counts?.poolAvailable} />
    </dl>
  );
}

/** Every project the user belongs to, for the project filter (the API caps a page at 100). */
function useProjectOptions() {
  return useQuery({
    queryKey: ["projects", "filter-options"],
    queryFn: async () => (await projectsApi.list(0, 100)).content.map((project) => ({ id: project.id, name: project.name })),
    staleTime: 60_000,
  });
}

function ListSkeleton() {
  return (
    <ul className="divide-y rounded-xl border bg-card" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((key) => (
        <li key={key} className="flex items-center gap-3 px-3 py-3">
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

function ErrorPanel({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useTranslations("tasks.my");
  const te = useTranslations("errors");
  return (
    <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm text-destructive">{te(errorKey(error))}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

function taskHref(task: Task): string {
  return `/projects/${task.project?.slug ?? ""}/tasks/${task.id}`;
}

function BucketedList({ tasks, userId }: { tasks: Task[]; userId: string }) {
  const t = useTranslations("tasks.my");
  const groups = useMemo(() => {
    const now = new Date();
    return BUCKETS.map((bucket) => ({ bucket, tasks: tasks.filter((task) => deadlineBucket(task.deadlineAt, now) === bucket) })).filter((group) => group.tasks.length > 0);
  }, [tasks]);

  return (
    <div className="space-y-5">
      {groups.map(({ bucket, tasks: items }) => (
        <section key={bucket} aria-label={t("bucketLabel", { bucket: t(`buckets.${bucket}`), count: items.length })} className="space-y-2">
          <h2 className={cn("flex items-baseline gap-2 text-sm font-semibold", bucket === "overdue" ? "text-destructive" : "text-foreground")}>
            {t(`buckets.${bucket}`)}
            <span className="text-xs font-normal tabular-nums text-muted-foreground">{items.length}</span>
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {items.map((task) => (
              <TaskRow key={task.id} task={task} href={taskHref(task)} showProject canChangeStatus={taskPermissions(task, userId, false).work} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FlatList({ tasks, userId, fetching }: { tasks: Task[]; userId: string; fetching: boolean }) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-xl border bg-card transition-opacity", fetching && "opacity-70")}>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} href={taskHref(task)} showProject canChangeStatus={taskPermissions(task, userId, false).work} />
      ))}
    </ul>
  );
}

function TasksPanel({ tab, userId, onClear, filtered }: { tab: Exclude<MyTab, "pool">; userId: string; onClear: () => void; filtered: boolean }) {
  const t = useTranslations("tasks.my");
  const { filters, update } = useMyTaskFilters();
  const query = useMyTasks(toMyTasksParams(filters));

  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <ListSkeleton />;

  const { content, totalElements, totalPages } = query.data;
  if (content.length === 0) {
    return filtered ? (
      <EmptyState
        title={t("noMatchTitle")}
        description={t("noMatchDescription")}
        action={
          <Button variant="outline" onClick={onClear}>
            {t("clearFilters")}
          </Button>
        }
      />
    ) : (
      <EmptyState title={t(`empty.${tab}.title`)} description={t(`empty.${tab}.description`)} />
    );
  }

  return (
    <>
      <p aria-live="polite" className="mb-2 text-xs tabular-nums text-muted-foreground">
        {t("count", { count: totalElements })}
      </p>
      {tab === "open" ? <BucketedList tasks={content} userId={userId} /> : <FlatList tasks={content} userId={userId} fetching={query.isFetching} />}
      <PaginationBar
        page={Math.min(filters.page, totalPages - 1)}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={TASK_PAGE_SIZE}
        onPageChange={(page) => {
          update({ page });
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}

function PoolPanel({ onClear, filtered }: { onClear: () => void; filtered: boolean }) {
  const t = useTranslations("tasks.my");
  const { filters, update } = useMyTaskFilters();
  const query = usePoolTasks({ projectId: filters.project || undefined, page: filters.page });

  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((key) => (
          <li key={key}>
            <Skeleton className="h-44 w-full rounded-xl" />
          </li>
        ))}
      </ul>
    );
  }

  const { content, totalElements, totalPages } = query.data;
  if (content.length === 0) {
    return filtered ? (
      <EmptyState
        title={t("noMatchTitle")}
        description={t("noMatchDescription")}
        action={
          <Button variant="outline" onClick={onClear}>
            {t("clearFilters")}
          </Button>
        }
      />
    ) : (
      <EmptyState title={t("empty.pool.title")} description={t("empty.pool.description")} />
    );
  }

  return (
    <>
      <p aria-live="polite" className="mb-2 text-xs tabular-nums text-muted-foreground">
        {t("poolCount", { count: totalElements })}
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {content.map((task) => (
          <PoolCard key={task.id} task={task} href={taskHref(task)} showProject />
        ))}
      </ul>
      <PaginationBar
        page={Math.min(filters.page, totalPages - 1)}
        totalPages={totalPages}
        totalElements={totalElements}
        pageSize={TASK_PAGE_SIZE}
        onPageChange={(page) => {
          update({ page });
          window.scrollTo({ top: 0 });
        }}
      />
    </>
  );
}

export function MyTasksPage() {
  const t = useTranslations("tasks.my");
  const tc = useTranslations("tasks.common");
  const { data: user } = useSession();
  const { filters, update, reset } = useMyTaskFilters();
  const counts = useMyTaskCounts();
  const projects = useProjectOptions();
  const filtered = activeMyFilterCount(filters) > 0;
  const poolTab = filters.tab === "pool";
  const projectName = projects.data?.find((project) => project.id === filters.project)?.name;

  function selectTab(next: string) {
    if ((MY_TABS as readonly string[]).includes(next)) update({ tab: next as MyTab });
  }

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <Summary counts={counts.data} />

      <Tabs value={filters.tab} onValueChange={(next) => selectTab(next as string)} className="mb-4">
        <TabsList aria-label={t("tabs.label")} className="max-w-full overflow-x-auto">
          {MY_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {t(`tabs.${tab}`)}
              {tab === "pool" && !!counts.data?.poolAvailable && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold tabular-nums text-primary-foreground">{counts.data.poolAvailable}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div role="search" aria-label={t("filters.label")} className="mb-4 flex flex-wrap items-center gap-2">
        <FilterButton label={projectName ?? t("filters.project")} count={filters.project ? 1 : 0} width="min-w-56">
          <DropdownMenuRadioGroup value={filters.project || "any"} onValueChange={(value) => update({ project: value === "any" ? "" : String(value) })}>
            <DropdownMenuRadioItem value="any">{t("filters.allProjects")}</DropdownMenuRadioItem>
            {projects.data?.map((project) => (
              <DropdownMenuRadioItem key={project.id} value={project.id}>
                <span className="truncate">{project.name}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </FilterButton>

        {!poolTab && (
          <>
            <FilterButton label={t("filters.status")} count={filters.status.length}>
              {TASK_STATUSES.map((status: TaskStatus) => (
                <DropdownMenuCheckboxItem key={status} checked={filters.status.includes(status)} onCheckedChange={() => update({ status: toggle(filters.status, status) })}>
                  <StatusDot status={status} />
                  {tc(`status.${status}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </FilterButton>
            <button
              type="button"
              aria-pressed={filters.overdue}
              onClick={() => update({ overdue: !filters.overdue })}
              className={cn(TRIGGER, filters.overdue && "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15")}
            >
              {t("filters.overdue")}
            </button>
          </>
        )}

        {filtered && (
          <button type="button" onClick={reset} className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground max-md:h-9" })}>
            <X size={13} aria-hidden="true" />
            {t("filters.clear")}
          </button>
        )}
      </div>

      {!user ? (
        <ListSkeleton />
      ) : poolTab ? (
        <PoolPanel onClear={reset} filtered={filtered} />
      ) : (
        <TasksPanel tab={filters.tab as Exclude<MyTab, "pool">} userId={user.id} onClear={reset} filtered={filtered} />
      )}
    </div>
  );
}
