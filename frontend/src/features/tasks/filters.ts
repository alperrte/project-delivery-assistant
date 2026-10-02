"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TASK_PRIORITIES, TASK_STATUSES } from "./types";
import type { SortDirection, TaskListParams, TaskPriority, TaskSortField, TaskStatus } from "./types";

export const GROUPINGS = ["none", "status", "assignee", "sprint"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const SORT_FIELDS: TaskSortField[] = ["updatedAt", "priority", "deadlineAt", "createdAt", "taskNumber"];

/** Smallest search the server accepts; shorter text stays in the box without hitting the API. */
export const MIN_SEARCH = 2;

export type TaskFilters = {
  q: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  /** A user id, `me` (resolved with the session) or `none` for unassigned; empty means everyone. */
  assignee: string;
  label: string[];
  /** A sprint id, `backlog`, or empty for any. */
  sprint: string;
  overdue: boolean;
  blocked: boolean;
  sort: TaskSortField;
  dir: SortDirection;
  /** Zero based; the URL carries it one based. */
  page: number;
  group: Grouping;
};

const DEFAULTS: TaskFilters = {
  q: "",
  status: [],
  priority: [],
  assignee: "",
  label: [],
  sprint: "",
  overdue: false,
  blocked: false,
  sort: "updatedAt",
  dir: "desc",
  page: 0,
  group: "none",
};

/** Dates and numbers read best soonest or lowest first; recency and priority most urgent first. */
export const defaultDirection = (sort: TaskSortField): SortDirection => (sort === "deadlineAt" || sort === "taskNumber" ? "asc" : "desc");

const list = (value: string | null): string[] => (value ? value.split(",").filter(Boolean) : []);

function parse(search: URLSearchParams): TaskFilters {
  const page = Number.parseInt(search.get("page") ?? "", 10);
  const requestedSort = search.get("sort") as TaskSortField | null;
  const sort = requestedSort && SORT_FIELDS.includes(requestedSort) ? requestedSort : DEFAULTS.sort;
  const requestedDir = search.get("dir");
  const group = search.get("group") as Grouping | null;
  return {
    q: search.get("q") ?? "",
    status: list(search.get("status")).filter((value): value is TaskStatus => (TASK_STATUSES as readonly string[]).includes(value)),
    priority: list(search.get("priority")).filter((value): value is TaskPriority => (TASK_PRIORITIES as readonly string[]).includes(value)),
    assignee: search.get("assignee") ?? "",
    label: list(search.get("label")),
    sprint: search.get("sprint") ?? "",
    overdue: search.get("overdue") === "1",
    blocked: search.get("blocked") === "1",
    sort,
    dir: requestedDir === "asc" || requestedDir === "desc" ? requestedDir : defaultDirection(sort),
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
    group: group && (GROUPINGS as readonly string[]).includes(group) ? group : DEFAULTS.group,
  };
}

function serialize(filters: TaskFilters): string {
  const search = new URLSearchParams();
  if (filters.q) search.set("q", filters.q);
  if (filters.status.length) search.set("status", filters.status.join(","));
  if (filters.priority.length) search.set("priority", filters.priority.join(","));
  if (filters.assignee) search.set("assignee", filters.assignee);
  if (filters.label.length) search.set("label", filters.label.join(","));
  if (filters.sprint) search.set("sprint", filters.sprint);
  if (filters.overdue) search.set("overdue", "1");
  if (filters.blocked) search.set("blocked", "1");
  if (filters.sort !== DEFAULTS.sort) search.set("sort", filters.sort);
  if (filters.dir !== DEFAULTS.dir) search.set("dir", filters.dir);
  if (filters.page > 0) search.set("page", String(filters.page + 1));
  if (filters.group !== DEFAULTS.group) search.set("group", filters.group);
  return search.toString();
}

/** How many filters (not sort, grouping or paging) narrow the list; drives the "clear" button. */
export function activeFilterCount(filters: TaskFilters): number {
  return (
    (filters.q.trim() ? 1 : 0) +
    (filters.status.length ? 1 : 0) +
    (filters.priority.length ? 1 : 0) +
    (filters.assignee ? 1 : 0) +
    (filters.label.length ? 1 : 0) +
    (filters.sprint ? 1 : 0) +
    (filters.overdue ? 1 : 0) +
    (filters.blocked ? 1 : 0)
  );
}

/** The server query for the current filters. `page` and `size` are left to the caller. */
export function toListParams(filters: TaskFilters, userId: string): TaskListParams {
  const q = filters.q.trim();
  return {
    q: q.length >= MIN_SEARCH ? q : undefined,
    status: filters.status.length ? filters.status : undefined,
    priority: filters.priority.length ? filters.priority : undefined,
    assigneeId: filters.assignee && filters.assignee !== "none" ? (filters.assignee === "me" ? userId : filters.assignee) : undefined,
    unassigned: filters.assignee === "none" || undefined,
    labelId: filters.label.length ? filters.label : undefined,
    sprintId: filters.sprint && filters.sprint !== "backlog" ? filters.sprint : undefined,
    backlog: filters.sprint === "backlog" || undefined,
    overdue: filters.overdue || undefined,
    blocked: filters.blocked || undefined,
    sort: filters.sort,
    direction: filters.dir,
  };
}

/** Filters live in the URL so a list can be shared, reloaded and reached with the back button. */
export function useTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const filters = useMemo(() => parse(new URLSearchParams(key)), [key]);

  const update = useCallback(
    (patch: Partial<TaskFilters>) => {
      // Changing any filter, sort or grouping starts again from the first page, unless the patch moves the page.
      const next = { ...filters, page: 0, ...patch };
      const text = serialize(next);
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const reset = useCallback(() => {
    update({ ...DEFAULTS, sort: filters.sort, dir: filters.dir, group: filters.group });
  }, [filters.dir, filters.group, filters.sort, update]);

  return { filters, update, reset };
}
