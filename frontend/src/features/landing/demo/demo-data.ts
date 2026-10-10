import type { Project, ProjectHome, Member } from "@/features/projects/types";
import type { Team, TeamMember } from "@/features/squads/types";
import type { Task } from "@/features/tasks/types";

export const DEMO_USER = { id: "pda-demo-alper", nickname: "Alper", email: "alper@example.com", globalRole: "USER", mustChangePassword: false };
const date = "2026-10-03T09:00:00Z";
export function demoData(text: { projectName: string; projectAbout: string; teamName: string; teamAbout: string; taskName: string }) {
  const members: Member[] = [
    { userId: DEMO_USER.id, nickname: "Alper", roles: ["PROJECT_MANAGER"], joinedAt: date },
    { userId: "pda-demo-deniz", nickname: "Deniz", roles: ["FULL_STACK_DEVELOPER"], joinedAt: date },
    { userId: "pda-demo-ece", nickname: "Ece", roles: ["TESTER"], joinedAt: date },
  ];
  const people = members.map(m => ({ userId: m.userId, nickname: m.nickname! }));
  const project: Project = {
    taskManagementMode: "BOTH",
    id: "pda-demo-project", slug: "pda-demo", name: text.projectName, description: text.projectAbout,
    status: "PLANNING", priority: "MEDIUM", startDate: null, targetEndDate: null, projectGoal: text.projectAbout,
    techStack: "Next.js, Spring Boot, PostgreSQL", visibility: "PRIVATE", organizationId: null,
    createdBy: DEMO_USER.id, createdAt: date, updatedAt: date, archivedAt: null, projectType: "WEB", tagline: text.projectAbout,
    logoVersion: null, bannerVersion: null, updatedBy: people[0], team: { memberCount: 3, preview: people },
  };
  const home: ProjectHome = {
    id: project.id, slug: project.slug, name: project.name, status: project.status, priority: project.priority,
    startDate: null, targetEndDate: null, organization: null, managers: [people[0]], teamMemberCount: 3,
    criteriaProgress: { completed: 0, total: 0 }, createdAt: date, updatedAt: date,
    repository: { connected: false, provider: null, repositoryOwner: null, repositoryName: null, defaultBranch: null, trackingMode: null, notifyOnCommits: false, lastCommit: null, githubUnavailable: false },
  };
  const team: Team = {
    id: "pda-demo-team", projectId: project.id, name: text.teamName, description: text.teamAbout,
    parentTeamId: null, memberCount: 3, createdBy: DEMO_USER.id, createdAt: date, updatedAt: date,
    updatedBy: people[0], memberPreview: members.map(m => ({ userId: m.userId, nickname: m.nickname!, roles: m.roles })), lastJoined: null,
  };
  const roster: TeamMember[] = members.map(m => ({ ...m, email: `${m.nickname!.toLowerCase()}@example.com`, addedBy: DEMO_USER.id, addedAt: date, otherTeams: [] }));
  const task: Task = {
    creationMode: "ADVANCED",
    id: "pda-demo-task", projectId: project.id, taskNumber: 1, taskKey: "PDA-1", title: text.taskName, description: text.projectAbout,
    status: "DONE", priority: "MEDIUM", startDate: null, deadlineAt: null, overdue: false, blocked: false, blockedReason: null,
    hasOpenBlockers: false, createdBy: DEMO_USER.id, createdByName: "Alper", createdAt: date, updatedBy: DEMO_USER.id, updatedByName: "Alper", updatedAt: date,
    archivedAt: null, version: 0, assigneeIds: [DEMO_USER.id], assignees: [people[0]], labels: [], parent: null,
    subtaskCount: 0, subtaskDoneCount: 0, checklistTotal: 0, checklistDone: 0, commentCount: 0, attachmentCount: 0,
    estimatePoints: null, timeEstimateMinutes: null, loggedMinutes: 0, sprint: null, pool: null, watching: false, project: { id: project.id, slug: project.slug, name: project.name, logoVersion: null },
  };
  return { project, home, team, members, roster, task };
}
export type DemoData = ReturnType<typeof demoData>;
export function demoPage<T>(content: T[]) { return { content, page: 0, size: 20, totalElements: content.length, totalPages: 1 }; }

/** Exact query contracts, resolved locally. Unknown queries fail closed instead of reaching an API. */
export function resolveDemoQuery(key: readonly unknown[], data: DemoData): unknown {
  if (key[0] === "session") return DEMO_USER;
  if (key[0] === "organizations" && key[1] === "picker") return demoPage([]);
  if (key[0] === "tasks" && key[1] === "counts") return { open: 1, overdue: 0, dueSoon: 0, blocked: 0, poolAvailable: 0 };
  if (key[0] === "projects") {
    if (key[1] === "sidebar-default") return demoPage([data.project]);
    if (key[1] === "by-slug") return key[2] ? data.project : undefined;
    if (key[2] === "home") return data.home;
    if (key[2] === "members") return key[3] === "me" ? data.members[0] : key[3] === "all" ? data.members : demoPage(data.members);
    if (key[2] === "invitations") return demoPage([]);
    if (key[2] === "criteria" || key[2] === "labels" || key[2] === "sprints") return [];
    if (key[2] === "squads") {
      if (key.includes("members")) return data.roster;
      if (key[3] === "all") return [data.team];
      if (key[3] === data.team.id) return data.team;
      return demoPage([data.team]);
    }
    if (key[2] === "tasks") return key[3] === "all" ? [data.task] : key[3] === "list" ? demoPage([data.task]) : undefined;
    if (key.includes("chat")) return { totalUnread: 0, conversations: [] };
  }
  return undefined;
}
