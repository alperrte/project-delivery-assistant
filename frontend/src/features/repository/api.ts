import { apiRequest } from "@/lib/api/client";
import type { Commit, RepositoryConnection } from "./types";

export const repositoryApi = {
  detail: (projectId: string) => apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`),
  connect: (projectId: string, repositoryUrl: string) =>
    apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`, { method: "POST", body: { repositoryUrl } }),
  disconnect: (projectId: string) => apiRequest<void>(`/projects/${projectId}/repository`, { method: "DELETE" }),
  commits: (projectId: string, limit?: number) =>
    apiRequest<Commit[]>(`/projects/${projectId}/repository/commits${limit ? `?limit=${limit}` : ""}`),
};
