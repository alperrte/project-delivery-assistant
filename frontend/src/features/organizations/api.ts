import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Project } from "@/features/projects/types";
import type { Organization } from "./types";
import type { OrganizationFormValues } from "./schemas";

export const organizationsApi = {
  list: (page: number, size = 20) => apiRequest<Page<Organization>>(`/organizations?page=${page}&size=${size}`),
  detail: (organizationId: string) => apiRequest<Organization>(`/organizations/${organizationId}`),
  projects: (organizationId: string, page: number, size = 20) =>
    apiRequest<Page<Project>>(`/organizations/${organizationId}/projects?page=${page}&size=${size}`),
  create: (body: OrganizationFormValues) => apiRequest<Organization>("/organizations", { method: "POST", body }),
  update: (organizationId: string, body: OrganizationFormValues) =>
    apiRequest<Organization>(`/organizations/${organizationId}`, { method: "PUT", body }),
  archive: (organizationId: string) => apiRequest<void>(`/organizations/${organizationId}/archive`, { method: "POST" }),
};
