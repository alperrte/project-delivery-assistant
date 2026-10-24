"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "@/i18n/navigation";
import { TASK_PRIORITIES, TASK_STATUSES } from "./types";
import type { SortDirection, TaskListParams, TaskPriority, TaskSortField, TaskStatus } from "./types";

export const GROUPINGS = ["none", "status", "assignee", "sprint"] as const;
export type Grouping = (typeof GROUPINGS)[number];

export const SORT_FIELDS: TaskSortField[] = ["updatedAt", "priority", "deadlineAt", "createdAt", "taskNumber"];

/** Smallest search the server accepts; shorter text stays in the box without hitting the API. */
export const MIN_SEARCH = 2;

export type TaskFilters = {
  creationMode: "" | "SIMPLE" | "ADVANCED";
  q: string;
  status: TaskStatus[];
  priority: TaskPriority[];
  label: string[];
  /** A sprint id, `backlog`, or empty for any. */
  sprint: string;
  /** Narrows to late open tasks; it is picked inside the status filter. */
  overdue: boolean;
  sort: TaskSortField;
  dir: SortDirection;
  /** Zero based; the URL carries it one based. */
  page: number;
  group: Grouping;
};

const DEFAULTS: TaskFilters = {
  creationMode: "",
  q: "",
  status: [],
  priority: [],
  label: [],
  sprint: "",
  overdue: false,
  sort: "updatedAt",
  // The project task list opens on "last update, ascending" until the person chooses otherwise (and then that choice is kept).
  dir: "asc",
  page: 0,
  group: "none",
};

/** Dates, last update and numbers read best from the start; priority most urgent first and creation newest first. */
export const defaultDirection = (sort: TaskSortField): SortDirection => (sort === "priority" || sort === "createdAt" ? "desc" : "asc");

/**
 * The sort a person last chose in the project task list, kept per signed-in user in this browser (never shared between accounts, and
 * nothing is stored for a visitor). An address that names its own sort wins over it; without either, the default above applies.
 */
export type SortPreference = { sort: TaskSortField; dir: SortDirection };
const PREFERENCE_EVENT = "pda:tasks-sort-preference";
const preferenceKey = (userId: string) => `pda:tasks-sort:v1:${userId}`;
function parsePreference(raw: string | null | undefined): SortPreference | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SortPreference> | null;
    return value && SORT_FIELDS.includes(value.sort as TaskSortField) && (value.dir === "asc" || value.dir === "desc") ? { sort: value.sort as TaskSortField, dir: value.dir } : null;
  } catch { return null; }
}
const subscribePreference = (notify: () => void) => {
  window.addEventListener("storage", notify); window.addEventListener(PREFERENCE_EVENT, notify);
  return () => { window.removeEventListener("storage", notify); window.removeEventListener(PREFERENCE_EVENT, notify); };
};
/** `ready` is false on the server and until the storage was read, so a list is never fetched with a sort that is about to change. */
function useSortPreference(userId: string | undefined) {
  const raw = useSyncExternalStore(
    subscribePreference,
    () => { if (!userId) return undefined; try { return window.localStorage.getItem(preferenceKey(userId)) ?? ""; } catch { return ""; } },
    () => undefined,
  );
  const save = useCallback((preference: SortPreference) => {
    if (!userId) return;
    try { window.localStorage.setItem(preferenceKey(userId), JSON.stringify(preference)); window.dispatchEvent(new Event(PREFERENCE_EVENT)); } catch { /* the choice then lasts for this page only */ }
  }, [userId]);
  const preference = useMemo(() => parsePreference(raw), [raw]);
  return { ready: raw !== undefined, preference, save };
}

const list = (value: string | null): string[] => (value ? value.split(",").filter(Boolean) : []);

function parse(search: URLSearchParams, preference: SortPreference | null): TaskFilters {
  const page = Number.parseInt(search.get("page") ?? "", 10);
  const requestedSort = search.get("sort") as TaskSortField | null;
  const namedSort = requestedSort && SORT_FIELDS.includes(requestedSort) ? requestedSort : null;
  // Order of authority: what the address says, then what this person chose before, then the default.
  const baseline: SortPreference = preference ?? { sort: DEFAULTS.sort, dir: DEFAULTS.dir };
  const sort = namedSort ?? baseline.sort;
  const requestedDir = search.get("dir");
  const group = search.get("group") as Grouping | null;
  return {
    creationMode: search.get("creationMode") === "SIMPLE" ? "SIMPLE" : search.get("creationMode") === "ADVANCED" ? "ADVANCED" : "",
    q: search.get("q") ?? "",
    status: list(search.get("status")).filter((value): value is TaskStatus => (TASK_STATUSES as readonly string[]).includes(value)),
    priority: list(search.get("priority")).filter((value): value is TaskPriority => (TASK_PRIORITIES as readonly string[]).includes(value)),
    label: list(search.get("label")),
    sprint: search.get("sprint") ?? "",
    overdue: search.get("overdue") === "1",
    sort,
    dir: requestedDir === "asc" || requestedDir === "desc" ? requestedDir : namedSort ? defaultDirection(sort) : baseline.dir,
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
    group: group && (GROUPINGS as readonly string[]).includes(group) ? group : DEFAULTS.group,
  };
}

function serialize(filters: TaskFilters): string {
  const search = new URLSearchParams();
  if (filters.creationMode) search.set("creationMode", filters.creationMode);
  if (filters.q) search.set("q", filters.q);
  if (filters.status.length) search.set("status", filters.status.join(","));
  if (filters.priority.length) search.set("priority", filters.priority.join(","));
  if (filters.label.length) search.set("label", filters.label.join(","));
  if (filters.sprint) search.set("sprint", filters.sprint);
  if (filters.overdue) search.set("overdue", "1");
  if (filters.sort !== DEFAULTS.sort) search.set("sort", filters.sort);
  if (filters.dir !== DEFAULTS.dir) search.set("dir", filters.dir);
  if (filters.page > 0) search.set("page", String(filters.page + 1));
  if (filters.group !== DEFAULTS.group) search.set("group", filters.group);
  return search.toString();
}

/** How many filters (not sort, grouping or paging) narrow the list; drives the "clear" button. */
export function activeFilterCount(filters: TaskFilters): number {
  return (
    (filters.creationMode ? 1 : 0) +
    (filters.q.trim() ? 1 : 0) +
    (filters.status.length ? 1 : 0) +
    (filters.priority.length ? 1 : 0) +
    (filters.label.length ? 1 : 0) +
    (filters.sprint ? 1 : 0) +
    (filters.overdue ? 1 : 0)
  );
}

/** The server query for the current filters. `page` and `size` are left to the caller. */
export function toListParams(filters: TaskFilters): TaskListParams {
  const q = filters.q.trim();
  return {
    creationMode: filters.creationMode || undefined,
    q: q.length >= MIN_SEARCH ? q : undefined,
    status: filters.status.length ? filters.status : undefined,
    priority: filters.priority.length ? filters.priority : undefined,
    labelId: filters.label.length ? filters.label : undefined,
    sprintId: filters.sprint && filters.sprint !== "backlog" ? filters.sprint : undefined,
    backlog: filters.sprint === "backlog" || undefined,
    overdue: filters.overdue || undefined,
    sort: filters.sort,
    direction: filters.dir,
  };
}

/** Filters live in the URL so a list can be shared, reloaded and reached with the back button. */
export function useTaskFilters(userId?: string) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const { ready, preference, save } = useSortPreference(userId);
  const filters = useMemo(() => parse(new URLSearchParams(key), preference), [key, preference]);

  const update = useCallback(
    (patch: Partial<TaskFilters>) => {
      // Changing any filter, sort or grouping starts again from the first page, unless the patch moves the page.
      const next = { ...filters, page: 0, ...patch };
      // A sort the person picks is remembered for the next visit; filters, paging and grouping never touch it.
      if ("sort" in patch || "dir" in patch) save({ sort: next.sort, dir: next.dir });
      const text = serialize(next);
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [filters, pathname, router, save],
  );

  const reset = useCallback(() => {
    update({ ...DEFAULTS, sort: filters.sort, dir: filters.dir, group: filters.group });
  }, [filters.dir, filters.group, filters.sort, update]);

  return { filters, update, reset, ready };
}
