export type RepositoryConnection = {
  provider: "GITHUB";
  repositoryUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  defaultBranch: string;
  connectedBy: string;
  connectedAt: string;
  updatedAt: string;
};

export type Commit = {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  /** GitHub username; null when the commit author has no GitHub account. */
  authorLogin: string | null;
  authorAvatarUrl: string | null;
  committedAt: string;
  commitUrl: string;
};

export type RepositoryBranch = {
  name: string;
  isDefault: boolean;
  isProtected: boolean;
  headShortSha: string;
};

export type RepositoryBranches = {
  branches: RepositoryBranch[];
  /** More branches exist than the 100 the page lists. */
  truncated: boolean;
};

export type RepositoryCompare = {
  base: string;
  branch: string;
  aheadBy: number;
  behindBy: number;
  /** Commits of the branch that are not on `base` yet, newest first. */
  unmergedCommits: Commit[];
  /** More than 100 unmerged commits exist; the list is cut. */
  truncated: boolean;
};

export type CommitQuery = {
  branch?: string;
  author?: string;
  page?: number;
  limit?: number;
};
