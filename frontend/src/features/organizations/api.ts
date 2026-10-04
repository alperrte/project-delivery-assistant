import { apiRequest, apiUrl } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Project } from "@/features/projects/types";
import type { Organization } from "./types";
import type { OrganizationFormValues } from "./schemas";

export function organizationImageSource(org: Pick<Organization, "id" | "logoVersion" | "coverVersion">, kind: "logo" | "cover") {
  const version = kind === "logo" ? org.logoVersion : org.coverVersion;
  return version ? apiUrl(`/organizations/${org.id}/${kind}?v=${encodeURIComponent(version)}`) : null;
}
function metadata(body: OrganizationFormValues) {
  return { name: body.name.trim(), ...Object.fromEntries(["description", "website", "contactEmail", "location", "notes"].map(key => [key, body[key as keyof OrganizationFormValues]?.trim() || null])) };
}
export const organizationsApi = {
  list: (page: number, size = 20) => apiRequest<Page<Organization>>(`/organizations?page=${page}&size=${size}`),
  allOwned: async (): Promise<Pick<Page<Organization>, "content">> => {
    const organizations = new Map<string, Organization>();
    for (let page = 0; ; page++) {
      const result = await organizationsApi.list(page, 100);
      for (const organization of result.content) organizations.set(organization.id, organization);
      if (!result.content.length || page + 1 >= result.totalPages) break;
    }
    return { content: [...organizations.values()] };
  },
  detail: (organizationId: string) => apiRequest<Organization>(`/organizations/${organizationId}`),
  projects: (organizationId: string, page: number, size = 20) =>
    apiRequest<Page<Project>>(`/organizations/${organizationId}/projects?page=${page}&size=${size}`),
  create: (body: OrganizationFormValues) => apiRequest<Organization>("/organizations", { method: "POST", body: metadata(body) }),
  update: (organizationId: string, body: OrganizationFormValues) =>
    apiRequest<Organization>(`/organizations/${organizationId}`, { method: "PUT", body: metadata(body) }),
  upload: (id: string, kind: "logo" | "cover", file: File) => {
    const body = new FormData(); body.append("file", file);
    return apiRequest<void>(`/organizations/${id}/${kind}`, { method: "PUT", body });
  },
  removeImage: (id: string, kind: "logo" | "cover") => apiRequest<void>(`/organizations/${id}/${kind}`, { method: "DELETE" }),
  archive: (organizationId: string) => apiRequest<void>(`/organizations/${organizationId}/archive`, { method: "POST" }),
};
