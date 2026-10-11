"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { X } from "@phosphor-icons/react";
import { EntityGrid } from "@/components/common/entity-card";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/features/auth/hooks/use-session";
import { projectsApi } from "@/features/projects/api";
import { errorKey } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import { TASK_PAGE_SIZE } from "../api";
import { deadlineBucket, type DeadlineBucket } from "../deadline";
import { useMyTaskCounts, useMyTasks } from "../hooks";
import { activeMyFilterCount, MY_TABS, toMyTasksParams, useMyTaskFilters, type MyTab } from "../my-filters";
import { taskPermissions } from "../permissions";
import { TASK_STATUSES, type MyTaskCounts, type Task, type TaskStatus } from "../types";
import { FilterButton, toggle } from "./task-filter-bar";
import { StatusDot } from "./task-badges";
import { MyTaskCard } from "./my-task-card";
import { MyTaskDialog } from "./my-task-dialog";
import { TaskTable } from "./task-table";
import { TaskViewToggle } from "./task-view-toggle";
import { useTaskView, type TaskView } from "../use-task-view";

const BUCKETS: DeadlineBucket[] = ["overdue", "today", "week", "later", "none"];

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

/** Three of the numbers the backend keeps for the signed-in user; `dueSoon` is the 24 hour reminder window. */
function Summary({ counts }: { counts: MyTaskCounts | undefined }) {
  const t = useTranslations("tasks.my.summary");
  return (
    <dl aria-label={t("label")} className="mb-5 grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card">
      <Stat label={t("open")} value={counts?.open} />
      <Stat label={t("overdue")} value={counts?.overdue} tone="danger" />
      <Stat label={t("dueSoon")} value={counts?.dueSoon} />
    </dl>
  );
}

/** Every project the user belongs to, for the project filter (the API caps a page at 100). */
function useProjectOptions() {
  return useQuery({
    queryKey: ["projects", "filter-options"],
    queryFn: async () => (await projectsApi.allVisible()).map((project) => ({ id: project.id, name: project.name })),
    staleTime: 60_000,
  });
}

function ListSkeleton() {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <li key={key}><Skeleton className="h-44 rounded-xl" /></li>
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

type OpenTask = (task: Task, comments?: boolean) => void;

function TaskCards({ tasks, userId, onOpen }: { tasks: Task[]; userId: string; onOpen: OpenTask }) {
  return (
    <EntityGrid>
      {tasks.map((task) => (
        <MyTaskCard key={task.id} task={task} onOpen={(comments) => onOpen(task, comments)} canChange={taskPermissions(task, userId, false).work} />
      ))}
    </EntityGrid>
  );
}

function BucketedList({ tasks, render }: { tasks: Task[]; render: (items: Task[]) => ReactNode }) {
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
          {render(items)}
        </section>
      ))}
    </div>
  );
}

function TasksPanel({ tab, view, userId, onClear, filtered, onOpen }: { tab: MyTab; view: TaskView; userId: string; onClear: () => void; filtered: boolean; onOpen: OpenTask }) {
  const t = useTranslations("tasks.my");
  const { filters, update } = useMyTaskFilters();
  const query = useMyTasks(toMyTasksParams(filters));
  useEffect(() => {
    if (query.data && !query.isPlaceholderData && filters.page > 0 && filters.page >= query.data.totalPages) {
      update({ page: Math.max(0, query.data.totalPages - 1) });
    }
  }, [query.data, query.isPlaceholderData, filters.page, update]);

  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending) return <ListSkeleton />;

  const { content, totalElements, totalPages } = query.data;
  const render = (items: Task[]) => view === "grid" ? (
    <TaskCards tasks={items} userId={userId} onOpen={onOpen} />
  ) : (
    <TaskTable
      tasks={items}
      label={t("title")}
      canChange={(task) => taskPermissions(task, userId, false).work}
      onOpen={onOpen}
      showProject
      progress
    />
  );
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
      {tab === "open" ? <BucketedList tasks={content} render={render} /> : <div className={cn("transition-opacity", query.isFetching && "opacity-70")}>{render(content)}</div>}
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
  const { view, setView } = useTaskView("my-tasks", "grid");
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const selectedId = search.get("task");
  const selectedProject = search.get("taskProject");
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const selection = selectedId && selectedProject && uuid.test(selectedId) && uuid.test(selectedProject)
    ? { taskId: selectedId, projectId: selectedProject, comments: search.get("comments") === "1" } : null;

  function openTask(task: Task, comments?: boolean) {
    const next = new URLSearchParams(search.toString());
    next.set("task", task.id); next.set("taskProject", task.projectId);
    if (comments) next.set("comments", "1"); else next.delete("comments");
    router.push(`${pathname}?${next}`, { scroll: false });
  }
  function closeTask() {
    const next = new URLSearchParams(search.toString());
    for (const key of ["task", "taskProject", "comments"]) next.delete(key);
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }
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

        <FilterButton label={t("filters.status")} count={filters.status.length + (filters.overdue ? 1 : 0)}>
          {TASK_STATUSES.map((status: TaskStatus) => (
            <DropdownMenuCheckboxItem key={status} checked={filters.status.includes(status)} onCheckedChange={() => update({ status: toggle(filters.status, status) })}>
              <StatusDot status={status} />
              {tc(`status.${status}`)}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={filters.overdue} onCheckedChange={(checked) => update({ overdue: checked })}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-destructive" />
            {t("filters.overdue")}
          </DropdownMenuCheckboxItem>
        </FilterButton>

        {filtered && (
          <button type="button" onClick={reset} className={buttonVariants({ variant: "ghost", size: "sm", className: "text-muted-foreground max-md:h-9" })}>
            <X size={13} aria-hidden="true" />
            {t("filters.clear")}
          </button>
        )}

        <div className="ml-auto"><TaskViewToggle view={view} onChange={setView} /></div>
      </div>

      {!user ? (
        <ListSkeleton />
      ) : (
        <TasksPanel tab={filters.tab} view={view} userId={user.id} onClear={reset} filtered={filtered} onOpen={openTask} />
      )}
      <MyTaskDialog selection={selection} onClose={closeTask} />
    </div>
  );
}
