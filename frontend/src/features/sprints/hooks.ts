"use client";

import { useQuery } from "@tanstack/react-query";
import { sprintsKey } from "@/features/tasks/hooks";
import { sprintsApi } from "./api";
import type { SprintStatus } from "./types";

export function useSprints(projectId: string, status?: SprintStatus) {
  return useQuery({
    queryKey: [...sprintsKey(projectId), "list", status ?? "all"],
    queryFn: () => sprintsApi.list(projectId, status),
    enabled: !!projectId,
  });
}

export function useSprint(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: [...sprintsKey(projectId), "detail", sprintId],
    queryFn: () => sprintsApi.detail(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  });
}

export function useSprintSummary(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: [...sprintsKey(projectId), "summary", sprintId],
    queryFn: () => sprintsApi.summary(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  });
}
