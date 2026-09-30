import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { SquadFormValues } from "./schemas";
import type { Squad, SquadMember } from "./types";

export const squadsApi = {
  list: (projectId: string, page: number, size = 20) =>
    apiRequest<Page<Squad>>(`/projects/${projectId}/teams?page=${page}&size=${size}`),
  detail: (projectId: string, squadId: string) => apiRequest<Squad>(`/projects/${projectId}/teams/${squadId}`),
  create: (projectId: string, body: SquadFormValues) =>
    apiRequest<Squad>(`/projects/${projectId}/teams`, { method: "POST", body }),
  update: (projectId: string, squadId: string, body: SquadFormValues) =>
    apiRequest<Squad>(`/projects/${projectId}/teams/${squadId}`, { method: "PUT", body }),
  move: (projectId: string, squadId: string, parentTeamId: string) =>
    apiRequest<Squad>(`/projects/${projectId}/teams/${squadId}/parent`, { method: "PUT", body: { parentTeamId } }),
  archive: (projectId: string, squadId: string) =>
    apiRequest<void>(`/projects/${projectId}/teams/${squadId}`, { method: "DELETE" }),
  members: (projectId: string, squadId: string, page: number, size = 20) =>
    apiRequest<Page<SquadMember>>(`/projects/${projectId}/teams/${squadId}/members?page=${page}&size=${size}`),
  addMember: (projectId: string, squadId: string, userId: string) =>
    apiRequest<SquadMember>(`/projects/${projectId}/teams/${squadId}/members`, { method: "POST", body: { userId } }),
  removeMember: (projectId: string, squadId: string, userId: string) =>
    apiRequest<void>(`/projects/${projectId}/teams/${squadId}/members/${userId}`, { method: "DELETE" }),
};
