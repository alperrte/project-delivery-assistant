import { apiRequest, apiUrl } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Project, ProjectHome, ProjectPriority, ProjectStatus, ProjectType } from "./types";

/** Cards per list page: divisible by 1, 2 and 3 so the last grid row is never half empty. */
export const PROJECT_PAGE_SIZE = 12;

export type CreateProjectBody = {
  name: string;
  description?: string;
  organizationId?: string;
  projectType: ProjectType;
  tagline?: string;
  techStack?: string;
};

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
  projectType?: ProjectType;
  tagline?: string | null;
};

/** Logo URL for `<img>`; `logoVersion` busts the one-year immutable cache when the logo changes. */
export function projectLogoUrl(projectId: string, logoVersion: number): string {
  return apiUrl(`/projects/${projectId}/logo?v=${logoVersion}`);
}

export const projectsApi = {
  list: (page: number, size = PROJECT_PAGE_SIZE) => apiRequest<Page<Project>>(`/projects?page=${page}&size=${size}`),
  detail: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  bySlug: (slug: string) => apiRequest<Project>(`/projects/by-slug/${slug}`),
  home: (projectId: string) => apiRequest<ProjectHome>(`/projects/${projectId}/home`),
  create: (body: CreateProjectBody) => apiRequest<Project>("/projects", { method: "POST", body }),
  update: (projectId: string, body: UpdateProjectValues) =>
    apiRequest<Project>(`/projects/${projectId}`, { method: "PUT", body }),
  uploadLogo: (projectId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<void>(`/projects/${projectId}/logo`, { method: "PUT", body });
  },
  deleteLogo: (projectId: string) => apiRequest<void>(`/projects/${projectId}/logo`, { method: "DELETE" }),
  archive: (projectId: string) => apiRequest<void>(`/projects/${projectId}/archive`, { method: "POST" }),
};
