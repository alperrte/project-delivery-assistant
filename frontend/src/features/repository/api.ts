import { apiRequest } from "@/lib/api/client";
import type { Commit, CommitQuery, RepositoryBranches, RepositoryCompare, RepositoryConnection } from "./types";

export const repositoryApi = {
  detail: (projectId: string) => apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`),
  connect: (projectId: string, repositoryUrl: string) =>
    apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`, { method: "POST", body: { repositoryUrl } }),
  disconnect: (projectId: string) => apiRequest<void>(`/projects/${projectId}/repository`, { method: "DELETE" }),
  commits: (projectId: string, { branch, author, page, limit }: CommitQuery = {}) => {
    const params = new URLSearchParams();
    if (branch) params.set("branch", branch);
    if (author) params.set("author", author);
    if (page) params.set("page", String(page));
    if (limit) params.set("limit", String(limit));
    const query = params.toString();
    return apiRequest<Commit[]>(`/projects/${projectId}/repository/commits${query ? `?${query}` : ""}`);
  },
  branches: (projectId: string) => apiRequest<RepositoryBranches>(`/projects/${projectId}/repository/branches`),
  compare: (projectId: string, branch: string) =>
    apiRequest<RepositoryCompare>(`/projects/${projectId}/repository/compare?${new URLSearchParams({ branch })}`),
};

export const repositoryKeys = {
  root: (projectId: string) => ["projects", projectId, "repository"] as const,
  branches: (projectId: string) => ["projects", projectId, "repository", "branches"] as const,
  commits: (projectId: string, branch: string | null, author: string | null) =>
    ["projects", projectId, "repository", "commits", branch, author] as const,
  compare: (projectId: string, branch: string) => ["projects", projectId, "repository", "compare", branch] as const,
};
