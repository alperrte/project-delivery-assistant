import { apiRequest } from "@/lib/api/client";
import type { SprintPayload } from "./schemas";
import type { CompleteTarget, Sprint, SprintStatus, SprintSummary } from "./types";

const base = (projectId: string) => `/projects/${projectId}/sprints`;

export const sprintsApi = {
  list: (projectId: string, status?: SprintStatus) =>
    apiRequest<Sprint[]>(`${base(projectId)}${status ? `?status=${status}` : ""}`),
  detail: (projectId: string, sprintId: string) => apiRequest<Sprint>(`${base(projectId)}/${sprintId}`),
  summary: (projectId: string, sprintId: string) => apiRequest<SprintSummary>(`${base(projectId)}/${sprintId}/summary`),
  create: (projectId: string, body: SprintPayload) => apiRequest<Sprint>(base(projectId), { method: "POST", body }),
  update: (projectId: string, sprintId: string, body: SprintPayload) =>
    apiRequest<Sprint>(`${base(projectId)}/${sprintId}`, { method: "PATCH", body }),
  start: (projectId: string, sprintId: string) =>
    apiRequest<Sprint>(`${base(projectId)}/${sprintId}/start`, { method: "POST" }),
  complete: (projectId: string, sprintId: string, moveOpenTasksTo: CompleteTarget) =>
    apiRequest<Sprint>(`${base(projectId)}/${sprintId}/complete`, { method: "POST", body: { moveOpenTasksTo } }),
  archive: (projectId: string, sprintId: string) =>
    apiRequest<void>(`${base(projectId)}/${sprintId}`, { method: "DELETE" }),
};
