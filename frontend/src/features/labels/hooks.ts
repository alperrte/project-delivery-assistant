"use client";

import { useQuery } from "@tanstack/react-query";
import { labelsKey } from "@/features/tasks/hooks";
import { labelsApi } from "./api";

export function useLabels(projectId: string, enabled = true) {
  return useQuery({
    queryKey: [...labelsKey(projectId), "list"],
    queryFn: () => labelsApi.list(projectId),
    enabled: !!projectId && enabled,
  });
}
