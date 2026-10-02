"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TASK_STATUSES } from "./types";
import type { MyTasksParams, TaskStatus } from "./types";

export const MY_TABS = ["open", "done", "all", "pool"] as const;
export type MyTab = (typeof MY_TABS)[number];

export type MyTaskFilters = {
  tab: MyTab;
  /** A project id; empty means every project. */
  project: string;
  status: TaskStatus[];
  overdue: boolean;
  /** Zero based; the URL carries it one based. */
  page: number;
};

const DEFAULTS: MyTaskFilters = { tab: "open", project: "", status: [], overdue: false, page: 0 };

function parse(search: URLSearchParams): MyTaskFilters {
  const tab = search.get("tab");
  const page = Number.parseInt(search.get("page") ?? "", 10);
  return {
    tab: (MY_TABS as readonly string[]).includes(tab ?? "") ? (tab as MyTab) : DEFAULTS.tab,
    project: search.get("project") ?? "",
    status: (search.get("status") ?? "").split(",").filter((value): value is TaskStatus => (TASK_STATUSES as readonly string[]).includes(value)),
    overdue: search.get("overdue") === "1",
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
  };
}

function serialize(filters: MyTaskFilters): string {
  const search = new URLSearchParams();
  if (filters.tab !== DEFAULTS.tab) search.set("tab", filters.tab);
  if (filters.project) search.set("project", filters.project);
  if (filters.status.length) search.set("status", filters.status.join(","));
  if (filters.overdue) search.set("overdue", "1");
  if (filters.page > 0) search.set("page", String(filters.page + 1));
  return search.toString();
}

/** Status and overdue only narrow the task tabs; the pool lists claimable tasks, which have no status of their own to pick. */
export function activeMyFilterCount(filters: MyTaskFilters): number {
  const narrowing = filters.tab !== "pool";
  return (filters.project ? 1 : 0) + (narrowing && filters.status.length ? 1 : 0) + (narrowing && filters.overdue ? 1 : 0);
}

/** The open tab is a worklist ordered by deadline; the others read best newest first. */
export function toMyTasksParams(filters: MyTaskFilters): MyTasksParams {
  const open = filters.tab === "open";
  return {
    scope: filters.tab === "done" ? "DONE" : filters.tab === "all" ? "ALL" : "OPEN",
    status: filters.status.length ? filters.status : undefined,
    projectId: filters.project || undefined,
    overdue: filters.overdue || undefined,
    sort: open ? "deadlineAt" : "updatedAt",
    direction: open ? "asc" : "desc",
    page: filters.page,
  };
}

/** Görevlerim keeps its tab and filters in the URL so a view can be reloaded and reached with the back button. */
export function useMyTaskFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = searchParams.toString();
  const filters = useMemo(() => parse(new URLSearchParams(key)), [key]);

  const update = useCallback(
    (patch: Partial<MyTaskFilters>) => {
      // Any change but paging itself starts again from the first page.
      const next = { ...filters, page: 0, ...patch };
      const text = serialize(next);
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  const reset = useCallback(() => update({ project: "", status: [], overdue: false }), [update]);

  return { filters, update, reset };
}
