import { apiRequest } from "@/lib/api/client";
import type { Page } from "@/types/pagination";
import type { TeamPayload } from "./schemas";
import type { Team, TeamCandidate, TeamMember } from "./types";

export const TEAM_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 100;

/** Pulls every page of a list endpoint. Teams and team rosters are small, so the client can filter and sort them. */
async function allPages<T>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const first = await fetchPage(0);
  const rest = await Promise.all(Array.from({ length: Math.max(first.totalPages - 1, 0) }, (_, index) => fetchPage(index + 1)));
  return [first, ...rest].flatMap((page) => page.content);
}

export const squadsApi = {
  list: (projectId: string, page: number, size = TEAM_PAGE_SIZE) =>
    apiRequest<Page<Team>>(`/projects/${projectId}/teams?page=${page}&size=${size}`),
  listAll: (projectId: string) =>
    allPages((page) => apiRequest<Page<Team>>(`/projects/${projectId}/teams?page=${page}&size=${MAX_PAGE_SIZE}`)),
  detail: (projectId: string, teamId: string) => apiRequest<Team>(`/projects/${projectId}/teams/${teamId}`),
  create: (projectId: string, body: TeamPayload) =>
    apiRequest<Team>(`/projects/${projectId}/teams`, { method: "POST", body }),
  update: (projectId: string, teamId: string, body: Pick<TeamPayload, "name" | "description">) =>
    apiRequest<Team>(`/projects/${projectId}/teams/${teamId}`, { method: "PUT", body }),
  /** `null` moves the team to the top level. */
  move: (projectId: string, teamId: string, parentTeamId: string | null) =>
    apiRequest<Team>(`/projects/${projectId}/teams/${teamId}/parent`, { method: "PUT", body: { parentTeamId } }),
  delete: (projectId: string, teamId: string) =>
    apiRequest<void>(`/projects/${projectId}/teams/${teamId}`, { method: "DELETE" }),
  members: (projectId: string, teamId: string, page: number, size = 20) =>
    apiRequest<Page<TeamMember>>(`/projects/${projectId}/teams/${teamId}/members?page=${page}&size=${size}`),
  allMembers: (projectId: string, teamId: string) =>
    allPages((page) =>
      apiRequest<Page<TeamMember>>(`/projects/${projectId}/teams/${teamId}/members?page=${page}&size=${MAX_PAGE_SIZE}`)),
  addMember: (projectId: string, teamId: string, userId: string) =>
    apiRequest<TeamMember>(`/projects/${projectId}/teams/${teamId}/members`, { method: "POST", body: { userId } }),
  removeMember: (projectId: string, teamId: string, userId: string) =>
    apiRequest<void>(`/projects/${projectId}/teams/${teamId}/members/${userId}`, { method: "DELETE" }),
  candidates: (projectId: string, teamId: string, query: string) =>
    apiRequest<TeamCandidate[]>(`/projects/${projectId}/teams/${teamId}/candidates?q=${encodeURIComponent(query)}`),
};
