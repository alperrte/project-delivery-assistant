import { apiRequest, apiUrl } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Project, ProjectHome, ProjectPriority, ProjectStatus, ProjectType, TaskManagementMode } from "./types";

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

/** Null-safe source shared by project cards, settings, header and chat. */
export function projectLogoSource(project: Pick<Project, "id" | "logoVersion">): string | null {
  return project.logoVersion == null ? null : projectLogoUrl(project.id, project.logoVersion);
}

/** Banner URL for `<img>`; `bannerVersion` busts the one-year immutable cache when the banner changes. */
export function projectBannerUrl(projectId: string, bannerVersion: number): string {
  return apiUrl(`/projects/${projectId}/banner?v=${bannerVersion}`);
}

export const projectsApi = {
  list: (page: number, size = PROJECT_PAGE_SIZE) => apiRequest<Page<Project>>(`/projects?page=${page}&size=${size}`),
  /** Selection controls must include visible projects beyond the first API page. */
  allVisible: async () => {
    const projects = new Map<string, Project>();
    for (let page = 0; ; page++) {
      const result = await apiRequest<Page<Project>>(`/projects?page=${page}&size=100`);
      for (const project of result.content) projects.set(project.id, project);
      if (!result.content.length || page + 1 >= result.totalPages) break;
    }
    return [...projects.values()];
  },
  detail: (projectId: string) => apiRequest<Project>(`/projects/${projectId}`),
  bySlug: (slug: string) => apiRequest<Project>(`/projects/by-slug/${slug}`),
  home: (projectId: string) => apiRequest<ProjectHome>(`/projects/${projectId}/home`),
  create: (body: CreateProjectBody) => apiRequest<Project>("/projects", { method: "POST", body }),
  setTaskManagementMode: (projectId: string, mode: TaskManagementMode) =>
    apiRequest<Project>(`/projects/${projectId}/task-management-mode`, { method: "PATCH", body: { mode } }),
  update: (projectId: string, body: UpdateProjectValues) =>
    apiRequest<Project>(`/projects/${projectId}`, { method: "PUT", body }),
  uploadLogo: (projectId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<void>(`/projects/${projectId}/logo`, { method: "PUT", body });
  },
  deleteLogo: (projectId: string) => apiRequest<void>(`/projects/${projectId}/logo`, { method: "DELETE" }),
  uploadBanner: (projectId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest<void>(`/projects/${projectId}/banner`, { method: "PUT", body });
  },
  deleteBanner: (projectId: string) => apiRequest<void>(`/projects/${projectId}/banner`, { method: "DELETE" }),
  /** Permanent: the project and everything in it. Only the project's founder may call it. */
  remove: (projectId: string) => apiRequest<void>(`/projects/${projectId}`, { method: "DELETE" }),
};
