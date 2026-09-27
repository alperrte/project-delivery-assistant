import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { SquadFormValues } from "./schemas";
import type { Squad, SquadMember } from "./types";

export const squadsApi = {
  list: (projectId: string, page: number, size = 20) =>
    apiRequest<Page<Squad>>(`/projects/${projectId}/squads?page=${page}&size=${size}`),
  detail: (projectId: string, squadId: string) => apiRequest<Squad>(`/projects/${projectId}/squads/${squadId}`),
  create: (projectId: string, body: SquadFormValues) =>
    apiRequest<Squad>(`/projects/${projectId}/squads`, { method: "POST", body }),
  update: (projectId: string, squadId: string, body: SquadFormValues) =>
    apiRequest<Squad>(`/projects/${projectId}/squads/${squadId}`, { method: "PUT", body }),
  archive: (projectId: string, squadId: string) =>
    apiRequest<void>(`/projects/${projectId}/squads/${squadId}/archive`, { method: "POST" }),
  members: (projectId: string, squadId: string, page: number, size = 20) =>
    apiRequest<Page<SquadMember>>(`/projects/${projectId}/squads/${squadId}/members?page=${page}&size=${size}`),
  addMember: (projectId: string, squadId: string, userId: string) =>
    apiRequest<SquadMember>(`/projects/${projectId}/squads/${squadId}/members`, { method: "POST", body: { userId } }),
  removeMember: (projectId: string, squadId: string, userId: string) =>
    apiRequest<void>(`/projects/${projectId}/squads/${squadId}/members/${userId}`, { method: "DELETE" }),
};
