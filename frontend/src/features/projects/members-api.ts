import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { Member, ProjectRole, UserSearchResult } from "./types";

export const membersApi = {
  list: (projectId: string, page: number, size = 20) =>
    apiRequest<Page<Member>>(`/projects/${projectId}/members?page=${page}&size=${size}`),
  detail: (projectId: string, userId: string) => apiRequest<Member>(`/projects/${projectId}/members/${userId}`),
  search: (projectId: string, query: string) =>
    apiRequest<UserSearchResult[]>(`/projects/${projectId}/members/search?query=${encodeURIComponent(query)}`),
  addRole: (projectId: string, userId: string, role: ProjectRole) =>
    apiRequest<Member>(`/projects/${projectId}/members/${userId}/roles`, { method: "POST", body: { role } }),
  replaceRoles: (projectId: string, userId: string, roles: ProjectRole[]) =>
    apiRequest<Member>(`/projects/${projectId}/members/${userId}/roles`, { method: "PUT", body: { roles } }),
  removeRole: (projectId: string, userId: string, role: ProjectRole) =>
    apiRequest<Member>(`/projects/${projectId}/members/${userId}/roles/${role}`, { method: "DELETE" }),
  remove: (projectId: string, userId: string) =>
    apiRequest<void>(`/projects/${projectId}/members/${userId}`, { method: "DELETE" }),
};
