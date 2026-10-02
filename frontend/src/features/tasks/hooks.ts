"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { membersApi } from "@/features/projects/members-api";
import { squadsApi } from "@/features/squads/api";
import { teamsKey } from "@/features/squads/hooks";
import { ApiError } from "@/lib/api/client";
import { errorKey } from "@/lib/api/error-message";
import { allTaskPages, myTasksApi, tasksApi } from "./api";
import type { MyTasksParams, TaskListParams, TimelineFilter } from "./types";

/** Prefix shared by every task query of a project, so one invalidation refreshes lists, boards and details. */
export const tasksKey = (projectId: string) => ["projects", projectId, "tasks"] as const;
export const taskKey = (projectId: string, taskId: string) => [...tasksKey(projectId), "detail", taskId] as const;
export const taskPartKey = (projectId: string, taskId: string, part: string, ...rest: unknown[]) =>
  [...taskKey(projectId, taskId), part, ...rest] as const;
export const labelsKey = (projectId: string) => ["projects", projectId, "labels"] as const;
export const sprintsKey = (projectId: string) => ["projects", projectId, "sprints"] as const;
/** Cross-project views: Görevlerim, the pool and the sidebar counters. */
export const myTasksKey = ["tasks"] as const;

/** A task change can show up in project lists, the board, sprint counters, Görevlerim and the pool. */
export function invalidateTaskViews(queryClient: QueryClient, projectId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: tasksKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: sprintsKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: labelsKey(projectId) }),
    queryClient.invalidateQueries({ queryKey: myTasksKey }),
  ]);
}

export function useTaskList(projectId: string, params: TaskListParams) {
  return useQuery({
    queryKey: [...tasksKey(projectId), "list", params],
    queryFn: () => tasksApi.list(projectId, params),
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  });
}

/** Every task matching the filters (up to the server page limit loops), for the board and pickers. */
export function useAllTasks(projectId: string, params: TaskListParams, enabled = true) {
  return useQuery({
    queryKey: [...tasksKey(projectId), "all", params],
    queryFn: () => allTaskPages(projectId, params),
    enabled: !!projectId && enabled,
  });
}

export function useTask(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskKey(projectId, taskId),
    queryFn: () => tasksApi.detail(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useSubtasks(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "subtasks"),
    queryFn: () => tasksApi.subtasks(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useChecklist(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "checklist"),
    queryFn: () => tasksApi.checklist(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useRelations(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "relations"),
    queryFn: () => tasksApi.relations(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useAttachments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "attachments"),
    queryFn: () => tasksApi.attachments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useWorklogs(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "worklogs"),
    queryFn: () => tasksApi.worklogs(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useWatchers(projectId: string, taskId: string) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "watchers"),
    queryFn: () => tasksApi.watchers(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useTimeline(projectId: string, taskId: string, filter: TimelineFilter) {
  return useQuery({
    queryKey: taskPartKey(projectId, taskId, "activity", filter),
    queryFn: () => tasksApi.activity(projectId, taskId, filter, 0, 50),
    enabled: !!projectId && !!taskId,
    placeholderData: keepPreviousData,
  });
}

export function useMyTasks(params: MyTasksParams) {
  return useQuery({
    queryKey: [...myTasksKey, "mine", params],
    queryFn: () => myTasksApi.mine(params),
    placeholderData: keepPreviousData,
  });
}

export function useMyTaskCounts() {
  return useQuery({ queryKey: [...myTasksKey, "counts"], queryFn: myTasksApi.counts, staleTime: 30_000 });
}

export function usePoolTasks(params: { projectId?: string; page?: number }) {
  return useQuery({
    queryKey: [...myTasksKey, "pool", params],
    queryFn: () => myTasksApi.pool(params),
    placeholderData: keepPreviousData,
  });
}

/**
 * A task mutation that refreshes every task view and reports a failure as a toast.
 * `errors.*` copy comes from `errorKey`, so new backend codes only need an i18n entry.
 */
export function useTaskMutation<TVars, TData>(
  projectId: string,
  mutationFn: (vars: TVars) => Promise<TData>,
  options: { onSuccess?: (data: TData, vars: TVars) => void; onError?: (err: unknown, vars: TVars) => boolean | void; silent?: boolean } = {},
) {
  const queryClient = useQueryClient();
  const te = useTranslations("errors");
  return useMutation({
    mutationFn,
    onSuccess: async (data, vars) => {
      await invalidateTaskViews(queryClient, projectId);
      options.onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      // A conflict or a vanished task means what is on screen is stale (someone else claimed it, moved it, archived it).
      if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
        void invalidateTaskViews(queryClient, projectId);
      }
      // A handler returning true took care of the message itself.
      if (options.onError?.(err, vars) === true) return;
      if (!options.silent) toast.error(te(errorKey(err)));
    },
  });
}

const MEMBER_PAGE = 100;

/** Every active member of the project; the assignee pickers, filters and mention list filter them on the client. */
export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "members", "all"],
    queryFn: async () => {
      const first = await membersApi.list(projectId, 0, MEMBER_PAGE);
      const rest = await Promise.all(
        Array.from({ length: Math.max(first.totalPages - 1, 0) }, (_, index) => membersApi.list(projectId, index + 1, MEMBER_PAGE)),
      );
      return [first, ...rest].flatMap((page) => page.content);
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

/** Active teams of the project, for the assignee filter and the pool's target team. */
export function useProjectTeams(projectId: string) {
  return useQuery({
    queryKey: [...teamsKey(projectId), "all"],
    queryFn: () => squadsApi.listAll(projectId),
    enabled: !!projectId,
    staleTime: 60_000,
  });
}

export function useTeamMembers(projectId: string, teamId: string) {
  return useQuery({
    queryKey: [...teamsKey(projectId), "members", teamId, "all"],
    queryFn: () => squadsApi.allMembers(projectId, teamId),
    enabled: !!projectId && !!teamId,
    staleTime: 60_000,
  });
}
