import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { CreateProjectValues } from "./schemas";
import type { Project, ProjectHome, ProjectPriority, ProjectStatus } from "./types";

export type UpdateProjectValues = {
  name: string;
  description?: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  startDate?: string | null;
  targetEndDate?: string | null;
  projectGoal?: string | null;
  techStack?: string | null;
  organizationId?: string | null;
};

export const projectsApi = {
  list: (page: number, size = 20) => apiRequest<Page<Project>>(`/projects?page=${page}&size=${size}`),
  detail: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  bySlug: (slug: string) => apiRequest<Project>(`/projects/by-slug/${slug}`),
  home: (projectId: string) => apiRequest<ProjectHome>(`/projects/${projectId}/home`),
  create: (body: CreateProjectValues) => apiRequest<Project>("/projects", { method: "POST", body }),
  update: (projectId: string, body: UpdateProjectValues) =>
    apiRequest<Project>(`/projects/${projectId}`, { method: "PUT", body }),
  archive: (projectId: string) => apiRequest<void>(`/projects/${projectId}/archive`, { method: "POST" }),
};
