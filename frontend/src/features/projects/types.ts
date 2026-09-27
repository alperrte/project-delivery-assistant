export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProjectVisibility = "PRIVATE";

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  projectGoal: string | null;
  techStack: string | null;
  visibility: ProjectVisibility;
  organizationId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type OrganizationSummary = { id: string; name: string; slug: string };
export type ManagerSummary = { userId: string; nickname: string };
export type CriteriaProgress = { completed: number; total: number };
export type CommitSummary = {
  shortSha: string;
  message: string;
  author: string;
  authorAvatarUrl: string | null;
  committedAt: string;
  commitUrl: string;
};
export type RepositorySummary = {
  connected: boolean;
  provider: "GITHUB" | null;
  repositoryOwner: string | null;
  repositoryName: string | null;
  defaultBranch: string | null;
  lastCommit: CommitSummary | null;
  githubUnavailable: boolean;
};

export const PROJECT_ROLES = [
  "PROJECT_MANAGER",
  "BACKEND_DEVELOPER",
  "FRONTEND_DEVELOPER",
  "FULL_STACK_DEVELOPER",
  "AI_ML_DEVELOPER",
  "UI_UX_DEVELOPER",
  "TESTER",
  "ANALYST",
] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export type Member = {
  userId: string;
  nickname: string | null;
  roles: ProjectRole[];
  joinedAt: string;
};

export type UserSearchResult = { userId: string; nickname: string };

export type ProjectHome = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string | null;
  targetEndDate: string | null;
  organization: OrganizationSummary | null;
  managers: ManagerSummary[];
  teamMemberCount: number;
  criteriaProgress: CriteriaProgress;
  repository: RepositorySummary;
  createdAt: string;
  updatedAt: string;
};
