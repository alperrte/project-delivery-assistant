import { apiRequest } from "@/lib/api/client";
import type { LabelFormValues } from "./schemas";
import type { Label } from "./types";

const base = (projectId: string) => `/projects/${projectId}/labels`;

export const labelsApi = {
  list: (projectId: string) => apiRequest<Label[]>(base(projectId)),
  create: (projectId: string, body: LabelFormValues) => apiRequest<Label>(base(projectId), { method: "POST", body }),
  update: (projectId: string, labelId: string, body: LabelFormValues) =>
    apiRequest<Label>(`${base(projectId)}/${labelId}`, { method: "PATCH", body }),
  archive: (projectId: string, labelId: string) =>
    apiRequest<void>(`${base(projectId)}/${labelId}`, { method: "DELETE" }),
};
