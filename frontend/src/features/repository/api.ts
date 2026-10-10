import type { QueryClient } from "@tanstack/react-query";
import { apiRequest, apiRequestWithHeaders } from "@/lib/api/client";
import type {
  Commit,
  CommitPage,
  CommitQuery,
  RepositoryBranches,
  RepositoryCompare,
  RepositoryConnection,
  RepositorySettings,
} from "./types";

/** The backend's page size when `limit` is left out. */
const DEFAULT_COMMIT_LIMIT = 10;

function commitParams({ branch, author, page, limit }: CommitQuery): string {
  const params = new URLSearchParams();
  if (branch) params.set("branch", branch);
  if (author) params.set("author", author);
  if (page) params.set("page", String(page));
  if (limit) params.set("limit", String(limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const repositoryApi = {
  detail: (projectId: string) => apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`),
  connect: (projectId: string, body: RepositorySettings & { repositoryUrl: string }) =>
    apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`, { method: "POST", body }),
  updateSettings: (projectId: string, body: RepositorySettings) =>
    apiRequest<RepositoryConnection>(`/projects/${projectId}/repository`, { method: "PATCH", body }),
  disconnect: (projectId: string) => apiRequest<void>(`/projects/${projectId}/repository`, { method: "DELETE" }),
  commits: (projectId: string, query: CommitQuery = {}) =>
    apiRequest<Commit[]>(`/projects/${projectId}/repository/commits${commitParams(query)}`),
  /**
   * One page of the commit history. GitHub gives no totals, so the backend says whether another page exists in the
   * `X-Has-Next-Page` header; a response without it falls back to "a full page means there may be more".
   */
  commitsPage: async (projectId: string, query: CommitQuery = {}, signal?: AbortSignal): Promise<CommitPage> => {
    const { data, headers } = await apiRequestWithHeaders<Commit[]>(
      `/projects/${projectId}/repository/commits${commitParams(query)}`,
      { signal },
    );
    const header = headers.get("X-Has-Next-Page");
    return { commits: data, hasNext: header === null ? data.length >= (query.limit ?? DEFAULT_COMMIT_LIMIT) : header === "true" };
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
  /** One page of a branch's history; the page and size are part of the key so pages never share cached rows. */
  commitsPage: (projectId: string, branch: string, author: string | null, page: number, limit: number) =>
    [...repositoryKeys.commits(projectId, branch, author), "page", page, limit] as const,
  compare: (projectId: string, branch: string) => ["projects", projectId, "repository", "compare", branch] as const,
};

/** The repository page, the sidebar "Depo" item and the overview strip all read these; refresh them together. */
export async function invalidateRepository(queryClient: QueryClient, projectId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: repositoryKeys.root(projectId) }),
    queryClient.invalidateQueries({ queryKey: ["projects", projectId, "home"] }),
  ]);
}
