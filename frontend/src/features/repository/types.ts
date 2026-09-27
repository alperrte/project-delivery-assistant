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
  shortSha: string;
  message: string;
  author: string;
  authorAvatarUrl: string | null;
  committedAt: string;
  commitUrl: string;
};
