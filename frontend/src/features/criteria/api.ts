import { apiRequest } from "@/lib/api/client";
import type { CriterionFormValues } from "./schemas";
import type { Criterion } from "./types";

export const criteriaApi = {
  list: (projectId: string) => apiRequest<Criterion[]>(`/projects/${projectId}/criteria`),
  create: (projectId: string, body: CriterionFormValues) =>
    apiRequest<Criterion>(`/projects/${projectId}/criteria`, { method: "POST", body }),
  update: (projectId: string, criterionId: string, body: CriterionFormValues) =>
    apiRequest<Criterion>(`/projects/${projectId}/criteria/${criterionId}`, { method: "PUT", body }),
  remove: (projectId: string, criterionId: string) =>
    apiRequest<void>(`/projects/${projectId}/criteria/${criterionId}`, { method: "DELETE" }),
  complete: (projectId: string, criterionId: string) =>
    apiRequest<Criterion>(`/projects/${projectId}/criteria/${criterionId}/complete`, { method: "POST" }),
  uncomplete: (projectId: string, criterionId: string) =>
    apiRequest<Criterion>(`/projects/${projectId}/criteria/${criterionId}/uncomplete`, { method: "POST" }),
  reorder: (projectId: string, orderedCriterionIds: string[]) =>
    apiRequest<Criterion[]>(`/projects/${projectId}/criteria/reorder`, {
      method: "POST",
      body: { orderedCriterionIds },
    }),
};
